"""Bake 2.5D sprite sheets of every actor for the phone renderer.

Run: .tools/blender-4.5.3-windows-x64/blender.exe -b --factory-startup --python-exit-code 1 --python art/bake_sprites.py

Each actor GLB is rendered with an orthographic camera at the game camera's
pitch (looking down ~47 degrees from the south) in 8 yaw directions. People get
four frames per direction (idle, walk A, walk B, fallen); vehicles and bosses
one. Role and livery variants are tinted and equipped exactly like the runtime
(infantry.ts, liveries.ts). Output: public/sprites/<key>.png sheets (columns =
directions, rows = frames) and public/sprites/manifest.json with each sheet's
world size and anchor, which src/sprites.ts uses to draw camera-facing quads.
"""
import bpy, math, os, sys, json
import numpy as np
from mathutils import Vector, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, 'public', 'models')
OUT = os.environ.get('NIGHTFALL_SPRITES_OUT') or os.path.join(ROOT, 'public', 'sprites')
TMP = os.path.join(OUT, '_cells')
os.makedirs(TMP, exist_ok=True)
DIRS = 8
# The game camera sits at (0, 27, 25) * reach from its target (three.js, +Z
# toward the viewer). In Blender (Z up, -Y toward the viewer) that is (0, -25, 27).
VIEW = Vector((0, -25, 27)).normalized()

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
world = bpy.data.worlds.new('Sprite sky')
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (.62, .7, .8, 1)
bg.inputs[1].default_value = .75


def light(name, rot, energy, color):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.color = color
    data.angle = .25
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot]


# Match the game's warm key from the south-west and a cool fill.
light('Warm key', (50, 0, -30), 3.4, (1, .94, .82))
light('Cool fill', (65, 0, 160), 1.1, (.72, .82, 1))
cam = bpy.data.objects.new('Sprite camera', bpy.data.cameras.new('Sprite camera'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
cam.rotation_euler = (-VIEW).to_track_quat('-Z', 'Y').to_euler()


def linear(hexcode):
    c = [int(hexcode[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c) + (1,)


def tint(objects, material, hexcode):
    """Recolour a named Blender material the way repaint()/equipInfantry() do."""
    rgba = linear(hexcode)
    for o in objects:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.name.startswith(material) or not m.use_nodes:
                continue
            if not m.name.endswith('.tint'):
                m = m.copy()
                m.name = material + '.tint'
                slot.material = m
            done = False
            for n in m.node_tree.nodes:
                if n.type == 'MIX' and getattr(n, 'data_type', '') == 'RGBA':
                    n.inputs[7].default_value = rgba
                    done = True
            if not done:
                bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
                if not bsdf.inputs['Base Color'].is_linked:
                    bsdf.inputs['Base Color'].default_value = rgba


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + '.glb'))
    objs = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name + ' sprite root', None)
    scene.collection.objects.link(root)
    for o in objs:
        if not o.parent:
            o.parent = root
    return root, objs + [root]


def joint(objs, suffix):
    return next((o for o in objs if o.name.split('.')[0].endswith('_' + suffix)), None)


def equip(objs, gear, scale=1.0):
    """Replace the hand-held weapon, as equipInfantry() does for specialists."""
    grip = joint(objs, 'Weapon')
    if not grip:
        return []
    for child in list(grip.children_recursive):
        bpy.data.objects.remove(child, do_unlink=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, gear + '.glb'))
    added = [o for o in bpy.data.objects if o not in before]
    for o in added:
        if not o.parent:
            o.parent = grip
            o.matrix_parent_inverse.identity()
            o.location = (0, 0, 0)
            o.scale = (scale, scale, scale)
    return added


def pose(objs, frame):
    """idle / walk A / walk B, by turning the rig's joint empties about local X
    (glTF imports joints with quaternion rotation, so compose quaternions)."""
    joints = [o for o in objs if o.type == 'EMPTY' and 'joint' in o.keys()]
    for o in joints:
        if o.get('_rest') is None:
            o.rotation_mode = 'QUATERNION'
            o['_rest'] = list(o.rotation_quaternion)
    for o in joints:
        o.rotation_quaternion = Quaternion(o['_rest'])
    swing = {1: 1, 2: -1}.get(frame, 0)

    def turn(o, angle):
        if o and angle:
            o.rotation_quaternion = o.rotation_quaternion @ Quaternion((1, 0, 0), angle)

    for side, s in (('L', 1), ('R', -1)):
        turn(joint(objs, 'Thigh' + side), .55 * swing * s)
        turn(joint(objs, 'Shin' + side), -.5 * max(0, -swing * s))
        turn(joint(objs, 'Arm' + side), -.3 * swing * s)


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def bake(key, model, cell, frames, variant=None):
    root, objs = load(model)
    if variant:
        variant(objs)
        objs = [o for o in bpy.data.objects if o == root or root in o.children_recursive or o in objs]
        objs = list({o.name: o for o in [root] + list(root.children_recursive)}.values())
    lo, hi = bounds(objs)
    # Square ortho window wide enough for every yaw (horizontal radius) and the
    # full height, centred on the model's mid-height above its origin.
    radius = max(Vector((lo.x, lo.y, 0)).length, Vector((hi.x, hi.y, 0)).length,
                 Vector((lo.x, hi.y, 0)).length, Vector((hi.x, lo.y, 0)).length)
    centre_z = (lo.z + hi.z) / 2
    size = max(2 * radius, hi.z - lo.z) * 1.12
    if frames > 1:
        size = max(size, 2.7)  # room for a fallen body and swinging blades
    cam.data.ortho_scale = size
    target = Vector((0, 0, centre_z))
    cam.location = target + VIEW * 40
    scene.render.resolution_x = scene.render.resolution_y = cell
    sheet = np.zeros((frames * cell, DIRS * cell, 4), dtype=np.float32)
    for f in range(frames):
        if frames > 1:
            pose(objs, f if f < 3 else 0)
        for d in range(DIRS):
            root.rotation_euler = (0, 0, d * math.tau / DIRS)
            root.location = (0, 0, 0)
            if f == 3:
                # Fallen: lying on the back, along the facing direction.
                root.rotation_euler = (-1.45, 0, d * math.tau / DIRS)
                root.location = (0, 0, .2)
            path = os.path.join(TMP, f'{key}_{f}_{d}.png')
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(path)
            px = np.array(img.pixels[:], dtype=np.float32).reshape(cell, cell, 4)
            bpy.data.images.remove(img)
            # Blender pixels start at the bottom row; sheet row 0 is the top.
            sheet[(frames - 1 - f) * cell:(frames - f) * cell, d * cell:(d + 1) * cell] = px
    out = bpy.data.images.new(key, DIRS * cell, frames * cell, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    file = key.replace(':', '-') + '.png'
    out.filepath_raw = os.path.join(OUT, file)
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)
    for o in objs:
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    return {'file': file, 'cell': cell, 'frames': frames, 'dirs': DIRS,
            'size': round(size, 4), 'centre': round(centre_z, 4)}


ROLE = {'rusher': ('ad4d32', 'weapon_knife', 1), 'swordsman': ('70685c', 'weapon_sword', 1),
        'thrower': ('be903e', 'weapon_knife', 1), 'rocketeer': ('b8642e', 'weapon_missile', 1.2)}
manifest = {}
HUMAN, BIG = 96, 192
manifest['rifleman'] = bake('rifleman', 'rifleman', HUMAN, 4)
for role, (colour, gear, scale) in ROLE.items():
    manifest['rifleman:' + role] = bake('rifleman:' + role, 'rifleman', HUMAN, 4,
                                        lambda objs, c=colour, g=gear, s=scale: (tint(objs, 'Sand canvas', c), equip(objs, g, s)))
manifest['ninja'] = bake('ninja', 'ninja', HUMAN, 4, lambda objs: equip(objs, 'weapon_katana'))
manifest['commando'] = bake('commando', 'commando', HUMAN, 4)
manifest['commando:ally'] = bake('commando:ally', 'commando', HUMAN, 4,
                                 lambda objs: (tint(objs, 'Hero bandana', '22d3f0'), equip(objs, 'weapon_rifle')))
manifest['commandoWoman:ally'] = bake('commandoWoman:ally', 'commandoWoman', HUMAN, 4,
                                      lambda objs: (tint(objs, 'Hero bandana', '22d3f0'), equip(objs, 'weapon_rifle')))
for name in ('captive', 'captiveWoman'):
    manifest[name] = bake(name, name, HUMAN, 1)
for name in ('tank', 'jeep', 'motorcycle', 'gunship', 'spider', 'laserTank', 'quadMech', 'rocketMech',
             'missileTruck', 'skyWraith', 'walker'):
    manifest[name] = bake(name, name, BIG, 1)
manifest['tank:hostile'] = bake('tank:hostile', 'tank', BIG, 1,
                                lambda objs: (tint(objs, 'Vehicle paint', 'c9964a'), tint(objs, 'Vehicle trim', '6e4f2b')))
with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
for name in os.listdir(TMP):
    os.remove(os.path.join(TMP, name))
os.rmdir(TMP)
print('SPRITES', len(manifest))
