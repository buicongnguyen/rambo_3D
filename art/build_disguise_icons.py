"""Render the wardrobe cards: each body in each disguise (transparent WebP).

Run: .tools/blender-4.5.3-windows-x64/blender.exe -b --factory-startup --python-exit-code 1 --python art/build_disguise_icons.py

Bodies are dressed from the shipped GLBs exactly as src/wardrobe.ts dresses them (tints,
hidden parts, pieces hung on joints with the woman's fit), so a card shows what you get.
Output: public/ui/look-<body>-<id>.webp ("none" is the plain fatigues).
NIGHTFALL_REVIEW=<png path> renders one review sheet of everything instead.
"""
import bpy, bmesh, json, math, os
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.environ.get('NIGHTFALL_MODELS_OUT') or os.path.join(ROOT, 'public', 'models')
BODIES = os.path.join(ROOT, 'public', 'models')
OUT = os.path.join(ROOT, 'public', 'ui')
REVIEW = os.environ.get('NIGHTFALL_REVIEW')
SIZE = 192
LOOKS = ['none', 'pirate', 'navy', 'knight', 'aodai', 'vietnam', 'mecha']

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = not REVIEW
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
world = bpy.data.worlds.new('Icon sky')
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (.62, .7, .8, 1)
bg.inputs[1].default_value = .7


def light(name, rot, energy, color):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.color = color
    data.angle = .2
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot]


light('Warm key', (50, 0, -32), 3.4, (1, .94, .82))
light('Cool fill', (65, 0, 160), 1.1, (.72, .82, 1))
camera = bpy.data.objects.new('Icon camera', bpy.data.cameras.new('Icon camera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = 'ORTHO'


def linear(hexcode):
    hexcode = hexcode.lstrip('#')
    c = [int(hexcode[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c) + (1,)


def tint(objects, material, hexcode):
    """Recolour a named material the way repaint() in liveries.ts does."""
    rgba = linear(hexcode)
    for o in objects:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            m = slot.material
            if not m or m.name.split('.')[0] != material or not m.use_nodes:
                continue
            m = m.copy()
            slot.material = m
            for n in m.node_tree.nodes:
                if n.type == 'MIX' and getattr(n, 'data_type', '') == 'RGBA':
                    n.inputs[7].default_value = rgba


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def joint_of(objects, name):
    return next(o for o in objects if o.type == 'EMPTY' and o.get('joint') == name)


def dress(body, look, x=0., turn=0.):
    """One body in one look at x, turned about Z. Returns its objects."""
    objects = load(os.path.join(BODIES, body + '.glb'))
    root = bpy.data.objects.new('%s %s' % (body, look), None)
    scene.collection.objects.link(root)
    for o in objects:
        if not o.parent:
            o.parent = root
    if look != 'none':
        kit = load(os.path.join(MODELS, 'disguises.glb'))
        bpy.context.view_layer.update()
        top = next(o for o in kit if o.name.split('.')[0] == 'dz_' + look)
        for material, colour in json.loads(top['tints']).items():
            tint(objects, material, colour)
        for entry in filter(None, top['hide'].split('|')):
            joint_name, material = entry.split(':')
            for o in joint_of(objects, joint_name).children:
                if o.type != 'MESH':
                    continue
                slots = [i for i, s in enumerate(o.material_slots) if s.material.name.split('.')[0] == material]
                bm = bmesh.new()
                bm.from_mesh(o.data)
                bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in slots], context='FACES')
                bm.to_mesh(o.data)
                bm.free()
        for wear in [o for o in kit if o.parent == top]:
            target = joint_of(objects, wear['wear'])
            fit = wear['fit'] if body == 'commandoWoman' else (1, 1, 1)
            scale = Matrix.Diagonal((fit[0], fit[2], fit[1], 1))  # three.js axes -> Blender
            for piece in [o for o in kit if o.parent == wear]:
                local = wear.matrix_world.inverted() @ piece.matrix_world
                piece.parent = target
                piece.matrix_parent_inverse = Matrix.Identity(4)
                piece.matrix_basis = scale @ local
                objects.append(piece)
        for o in kit:
            if o not in objects:
                bpy.data.objects.remove(o, do_unlink=True)
    root.location.x = x
    root.rotation_euler.z = turn
    return objects + [root]


def aim(target, direction, scale, width, height):
    camera.data.ortho_scale = scale
    camera.location = Vector(target) + Vector(direction).normalized() * 30
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = width, height


if REVIEW:
    for row, body in enumerate(('commando', 'commandoWoman')):
        for i, look in enumerate(LOOKS):
            dress(body, look, i * 1.25, 0)
            dress(body, look, i * 1.25 + 8.9, math.pi * .8)
    bpy.ops.mesh.primitive_plane_add(size=80)
    # The rows stand at the same spot; move the second row back.
    for o in scene.objects:
        if o.type == 'EMPTY' and not o.parent and o.name.startswith('commandoWoman'):
            o.location.y = 3.2
    if os.environ.get('NIGHTFALL_REVIEW_CLOSE'):
        # Front views only, one body: NIGHTFALL_REVIEW_CLOSE=0 (commando) or 1 (woman).
        aim((3.75, 3.2 * int(os.environ['NIGHTFALL_REVIEW_CLOSE']), 1.08), (-.3, -1, .4), 8.9, 2400, 760)
    else:
        aim((8.2, 1.6, 1.0), (-.25, -1, .55), 18.6, 2400, 900)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = REVIEW
    bpy.ops.render.render(write_still=True)
else:
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.quality = 88
    aim((0, 0, 1.06), (-.42, -1, .34), 2.42, SIZE, SIZE)
    for body in ('commando', 'commandoWoman'):
        for look in LOOKS:
            objects = dress(body, look)
            scene.render.filepath = os.path.join(OUT, 'look-%s-%s.webp' % (body, look))
            bpy.ops.render.render(write_still=True)
            for o in objects:
                bpy.data.objects.remove(o, do_unlink=True)
    print('LOOK ICONS', 2 * len(LOOKS))
