"""Render the debrief and shop icons (transparent PNGs) in the Nightfall style.

Run: blender -b --factory-startup --python-exit-code 1 --python art/build_ui_icons.py
Icons reuse the game's GLBs where possible (treasure, weapons, crate) and build a
few emblems (stars, credit coin, armour vest, light-kit bolt) with the shared kit.
"""
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, 'public', 'models')
OUT = os.path.join(ROOT, 'public', 'ui')
os.makedirs(OUT, exist_ok=True)
SIZE = 160

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.compression = 100
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
world = bpy.data.worlds.new('Icon sky')
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (.62, .7, .8, 1)
bg.inputs[1].default_value = .55


def light(name, rot, energy, color):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.color = color
    data.angle = .2
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot]


light('Warm key', (48, 0, -38), 3.6, (1, .93, .8))
light('Cool fill', (62, 0, 150), 1.2, (.7, .82, 1))
light('Rim', (-60, 0, 20), 2.2, (1, 1, 1))
camera = bpy.data.objects.new('Icon camera', bpy.data.cameras.new('Icon camera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.lens = 70

K = style.Kit()
gold = K.mat('Icon gold', '#ffdd4d', .24, .1, ramp=(.84, 1.0))
gold_dark = K.mat('Icon gold edge', '#f5a51f', .3, .1, ramp=(.8, 1.0))
slate = K.mat('Icon empty star', '#46525c', .55, .3, ramp=(.7, 1.0))
olive = K.mat('Icon vest', '#3f7a26', .6)
webbing = K.mat('Icon webbing', '#c89a4b', .65)
crimson = K.mat('Icon crimson', '#c4162a', .45)


def star(material, depth=.28):
    points = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = 1.0 if i % 2 == 0 else .45
        points.append((math.cos(a) * r, math.sin(a) * r))
    return K.prism('Star', points, depth, material, axis='Y', bevel=.09, segments=3)


def coin():
    K.cyl('Coin', (0, 0, 0), 1, .26, gold, 'Y', 40, .08, segments=3)
    K.cyl('Coin rim', (0, -.14, 0), .82, .03, gold_dark, 'Y', 40)
    s = star(gold, .1)
    s.scale = (.55, 1, .55)
    s.location = (0, -.16, 0)


def vest():
    K.tbox('Vest', (0, 0, 0), (1.3, .5), (1.05, .45), 1.3, olive, .18)
    for x in (-.35, 0, .35):
        K.box('Pouch', (x, -.3, -.2), (.3, .16, .38), webbing, .05)
    for x in (-.42, .42):
        K.box('Strap', (x, -.02, .72), (.24, .48, .18), olive, .06)
    K.box('Plate stripe', (0, -.26, .3), (.9, .04, .12), crimson, .02)


def bolt():
    shape = [(.15, 1.1), (-.55, -.05), (-.05, -.05), (-.3, -1.1), (.55, .2), (.05, .2), (.4, 1.1)]
    K.prism('Lightning bolt', shape, .3, K.mat('Icon bolt', '#ffd21f', .3, .2), axis='Y', bevel=.07, segments=3)
    K.prism('Bolt outline', [(x * 1.12, z * 1.08) for x, z in shape], .2,
                      K.mat('Icon bolt edge', '#2b3238', .5), (0, .08, 0), axis='Y', bevel=.04)


def weapon(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name + '.glb'))
    return [o for o in bpy.data.objects if o not in before]


def render(name, build, view=(.75, -1.1, .75), spin=0, pad=1.18):
    before = set(bpy.data.objects)
    build()
    objects = [o for o in bpy.data.objects if o not in before]
    K.current = []
    root = bpy.data.objects.new(name + ' root', None)
    scene.collection.objects.link(root)
    for o in objects:
        if not o.parent:
            o.parent = root
    root.rotation_euler = (0, 0, math.radians(spin))
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objects if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, radius = (lo + hi) / 2, (hi - lo).length / 2
    d = Vector(view).normalized()
    fov = camera.data.angle
    camera.location = centre + d * radius * pad / math.sin(fov / 2)
    camera.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    for o in objects + [root]:
        bpy.data.objects.remove(o, do_unlink=True)


front = (.12, -1, .42)
render('star', lambda: star(gold), front)
render('star-empty', lambda: star(slate), front)
render('coin', coin, (.35, -1, .25))
render('money', lambda: weapon('money'), (.5, -.9, 1.0))
render('gold', lambda: weapon('gold'), (.6, -1, .8))
render('diamond', lambda: weapon('diamond'), (.4, -1, .7))
render('upgrade-armor', vest, (.45, -1, .35))
render('upgrade-power', lambda: weapon('weapon_rifle'), (1, -.25, .35), pad=1.05)
render('upgrade-mobility', bolt, (.3, -1, .15))
render('field-kit', lambda: weapon('crate'), (.8, -1, .8))
for w in ('shotgun', 'machineGun', 'launcher', 'missile', 'laser'):
    render('weapon-' + w, lambda w=w: weapon('weapon_' + w), (1, -.25, .35), pad=1.05)
print('ICONS', sorted(os.listdir(OUT)))
