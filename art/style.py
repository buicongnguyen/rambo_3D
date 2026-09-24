"""Nightfall stylized art kit: chunky toy-like forms, soft bevels and painted light.

Every textured material is a tiny vertical colour ramp (cool shadow at the bottom,
warm light at the top). `paint_height()` maps each exported asset's height onto
that ramp, so all models share a hand-painted ambient-occlusion look for a few
hundred bytes instead of per-material noise textures.

Colours are authored as sRGB hex values, like a paint swatch. Blender is Z-up and
-Y is forward; glTF export converts that to Three.js +Y up / +Z forward.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

PALETTE = {
    # Hero and friendly forces: saturated jungle green, bright tan, signal red.
    'hero_green': '#4f8a2b', 'hero_green_dark': '#2f5a1c', 'webbing': '#c89a4b',
    'bandana': '#e0262b', 'skin': '#d98b5b', 'skin_shadow': '#b0643c', 'hair': '#2a1a12',
    # Hostile forces: warm khaki with crimson identification.
    'khaki': '#d1a55c', 'khaki_dark': '#8e6a33', 'crimson': '#c4162a',
    # Allies and pickups.
    'ivory': '#f1ead2', 'cyan': '#22d3f0', 'teal_glass': '#2fb5c8',
    # Shared hardware.
    'gunmetal': '#2b3238', 'steel': '#8c9aa3', 'rubber': '#23262a', 'sole': '#5a3b24',
    'wood': '#9a5b2e', 'wood_light': '#c98b4f', 'brass': '#f2b134', 'hazard': '#ffbf1f',
    'lamp': '#fff2b0', 'rust': '#d2552a', 'olive_paint': '#6f8f2f', 'desert_paint': '#d8a24a',
}


def srgb(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


def linear(c):
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


class Kit:
    """Material library plus primitive builders that collect objects for export."""

    def __init__(self):
        self.materials = {}
        self.ramps = {}
        self.current = []

    # ------------------------------------------------------------------ materials
    def ramp(self, lo=.70, hi=1.0):
        """Neutral painted-light ramp (sRGB): cool shadow at V=0, warm light at V=1."""
        key = (round(lo, 3), round(hi, 3))
        if key in self.ramps:
            return self.ramps[key]
        size = 32
        pixels = []
        for y in range(size):
            t = y / (size - 1)
            t = t * t * (3 - 2 * t)
            k = lo + (hi - lo) * t
            tint = (1 - .05 * (1 - t), 1 - .02 * (1 - t), 1 + .04 * (1 - t) - .05 * t)
            pixels.extend(([max(0., min(1., k * c)) for c in tint] + [1.]) * 2)
        image = bpy.data.images.new('Painted light %.2f-%.2f' % key, width=2, height=size)
        image.pixels.foreach_set(pixels)
        image.pack()
        self.ramps[key] = image
        return image

    def mat(self, name, color, rough=.55, metal=0., emit=0., ramp=(.70, 1.0), cull=True):
        """Painted PBR material: colour factor x shared neutral ramp texture.

        Keeping the colour in baseColorFactor lets runtime variants (enemy roles,
        allies, hostile armour) recolour a clone without fighting the texture.
        """
        if name in self.materials:
            return self.materials[name]
        c = linear(srgb(color) if isinstance(color, str) else tuple(color))
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*c, 1)
        m.use_nodes = True
        m.use_backface_culling = cull
        tree = m.node_tree
        p = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
        p.inputs['Base Color'].default_value = (*c, 1)
        p.inputs['Roughness'].default_value = rough
        p.inputs['Metallic'].default_value = metal
        if emit:
            p.inputs['Emission Color'].default_value = (*c, 1)
            p.inputs['Emission Strength'].default_value = emit
        elif ramp:
            tex = tree.nodes.new('ShaderNodeTexImage')
            tex.image = self.ramp(*ramp)
            tex.extension = 'EXTEND'
            mix = tree.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1
            tree.links.new(tex.outputs['Color'], mix.inputs[6])
            mix.inputs[7].default_value = (*c, 1)
            tree.links.new(mix.outputs[2], p.inputs['Base Color'])
        self.materials[name] = m
        return m

    # ----------------------------------------------------------------- primitives
    def finish(self, o, name, material, smooth=True, weighted=True):
        o.name = name
        o.data.materials.clear()
        o.data.materials.append(material)
        if smooth:
            for poly in o.data.polygons:
                poly.use_smooth = True
            if weighted and len(o.data.polygons) > 6:
                mod = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
                mod.keep_sharp = True
        self.current.append(o)
        return o

    def _apply(self, o, bevel=0, segments=3, limit=None):
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            mod = o.modifiers.new('Soft bevel', 'BEVEL')
            mod.width = bevel
            mod.segments = segments
            mod.limit_method = 'ANGLE' if limit is None else limit
            bpy.ops.object.modifier_apply(modifier=mod.name)

    def box(self, name, loc, size, material, bevel=.04, segments=None, rot=None):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.scale = size
        # Rounded shoulders only where they read at gameplay distance.
        if segments is None:
            segments = 3 if min(size) >= .5 else 2 if min(size) >= .1 else 1
        self._apply(o, min(bevel, min(size) * .49), segments)
        if rot:
            o.rotation_euler = rot
        return self.finish(o, name, material)

    def tbox(self, name, loc, top, bottom, height, material, bevel=.04, segments=2, shift=(0, 0)):
        """Tapered box: `top`/`bottom` are (x, y) sizes; `shift` slides the top face."""
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        for v in o.data.vertices:
            s = top if v.co.z > 0 else bottom
            v.co.x *= s[0]
            v.co.y *= s[1]
            v.co.z *= height
            if v.co.z > 0:
                v.co.x += shift[0]
                v.co.y += shift[1]
        self._apply(o, min(bevel, height * .49, min(top + bottom) * .49), segments)
        return self.finish(o, name, material)

    def sphere(self, name, loc, radii, material, segments=16, rings=10):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
        o = bpy.context.object
        o.scale = radii if isinstance(radii, (tuple, list)) else (radii,) * 3
        self._apply(o)
        return self.finish(o, name, material, weighted=False)

    def cyl(self, name, loc, radius, depth, material, axis='Z', vertices=16, bevel=0, radius2=None, segments=2):
        if radius2 is None:
            bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
        else:
            bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius2, depth=depth, location=loc)
        o = bpy.context.object
        if bevel:
            self._apply(o, min(bevel, depth * .45, radius * .9), segments)
        o.rotation_euler = {'Z': (0, 0, 0), 'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0)}[axis]
        return self.finish(o, name, material)

    def limb(self, name, a, b, r1, r2, material, vertices=12):
        """Tapered, round-ended capsule from point a to b."""
        a, b = Vector(a), Vector(b)
        d = b - a
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
        o = bpy.context.object
        self._apply(o, min(r1, r2) * .8, 2)
        o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        return self.finish(o, name, material)

    def rod(self, name, a, b, radius, material, vertices=8):
        a, b = Vector(a), Vector(b)
        d = b - a
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=d.length, location=(a + b) / 2)
        o = bpy.context.object
        o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        return self.finish(o, name, material)

    def prism(self, name, profile, width, material, loc=(0, 0, 0), axis='X', bevel=.02, segments=2):
        """Extrude a side profile [(y, z), ...] (axis X) or front profile [(x, z)] (axis Y)."""
        bm = bmesh.new()
        if axis == 'X':
            verts = [bm.verts.new((-width / 2, p[0], p[1])) for p in profile]
            vec = Vector((width, 0, 0))
        else:
            verts = [bm.verts.new((p[0], -width / 2, p[1])) for p in profile]
            vec = Vector((0, width, 0))
        face = bm.faces.new(verts)
        bmesh.ops.recalc_face_normals(bm, faces=[face])
        ext = bmesh.ops.extrude_face_region(bm, geom=[face])
        bmesh.ops.translate(bm, vec=vec, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        o = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(o)
        o.location = loc
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        if bevel:
            mod = o.modifiers.new('Soft bevel', 'BEVEL')
            mod.width = bevel
            mod.segments = segments
            mod.limit_method = 'ANGLE'
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return self.finish(o, name, material)

    def tire(self, name, loc, radius, width, rubber, rim, hub=None, lugs=10, axis='X'):
        """Fat, round-shouldered tyre with a bright dished rim and chunky tread lugs."""
        parts = []
        t = self.cyl(name, loc, radius, width, rubber, axis, 24, bevel=width * .38, segments=3)
        parts.append(t)
        side = 1
        for s in (-1, 1):
            off = Vector((s * width * .47, 0, 0)) if axis == 'X' else Vector((0, s * width * .47, 0))
            parts.append(self.cyl('Wheel rim', Vector(loc) + off, radius * .56, width * .12, rim, axis, 16, bevel=.012))
            if hub:
                off2 = off * 1.12
                parts.append(self.cyl('Wheel hub cap', Vector(loc) + off2, radius * .22, width * .12, hub, axis, 10, bevel=.01))
        for i in range(lugs):
            a = i * math.tau / lugs
            if axis == 'X':
                p = Vector(loc) + Vector((0, math.sin(a) * radius * .97, math.cos(a) * radius * .97))
                o = self.box('Tread lug', p, (width * .78, radius * .20, radius * .12), rubber, .015, 1)
                o.rotation_euler.x = -a
            else:
                p = Vector(loc) + Vector((math.sin(a) * radius * .97, 0, math.cos(a) * radius * .97))
                o = self.box('Tread lug', p, (radius * .20, width * .78, radius * .12), rubber, .015, 1)
                o.rotation_euler.y = a
            parts.append(o)
        return parts

    # ------------------------------------------------------------------ hierarchy
    def joint(self, name, loc, parent=None):
        o = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(o)
        o.location = loc
        o['joint'] = name.split('_', 1)[1]
        self.current.append(o)
        if parent:
            self.attach(o, parent)
        return o

    def attach(self, obj, parent):
        bpy.context.view_layer.update()
        world = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = world
        return obj

    # --------------------------------------------------------------------- export
    def paint_height(self, objects, lo=None, hi=None, flat=None):
        """Map each mesh's world height to its material ramp (V), U fixed at 0.5.

        `flat` paints one constant ramp value instead, so tiny pickups can keep
        sharing identical mesh data.
        """
        bpy.context.view_layer.update()
        meshes = [o for o in objects if o.type == 'MESH']
        if not meshes:
            return
        zs = [(o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices]
        lo = min(zs) if lo is None else lo
        hi = max(zs) if hi is None else hi
        span = max(hi - lo, 1e-4)
        for o in meshes:
            mesh = o.data
            if mesh.users > 1:
                o.data = mesh = mesh.copy()
            uv = mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
            mw = o.matrix_world
            for loop in mesh.loops:
                if flat is not None:
                    uv.data[loop.index].uv = (.5, flat)
                    continue
                z = (mw @ mesh.vertices[loop.vertex_index].co).z
                uv.data[loop.index].uv = (.5, .03 + .94 * max(0., min(1., (z - lo) / span)))

    def export(self, path, objects=None, extras=True):
        objects = list(self.current if objects is None else objects)
        self.paint_height(objects)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                                  export_extras=extras, export_apply=True)
        return objects
