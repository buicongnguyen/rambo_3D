"""Render the wardrobe cards: each hero body in each look (transparent WebP).

Run: .tools/blender-4.5.3-windows-x64/blender.exe -b --factory-startup --python-exit-code 1 --python art/build_disguise_icons.py

Bodies are dressed by disguise_dress.py, the Blender twin of src/wardrobe.ts, so a card
shows what the game draws. Output: public/ui/look-<body>-<look>.webp ("none" is the
plain fatigues). NIGHTFALL_REVIEW=<absolute png path> renders one review sheet of every
body and look, front and back, instead.
"""
import bpy, math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import disguise_dress as dz

MODELS = os.environ.get('NIGHTFALL_MODELS_OUT') or dz.MODELS
OUT = os.path.join(dz.ROOT, 'public', 'ui')
REVIEW = os.environ.get('NIGHTFALL_REVIEW')
SIZE = 192

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


def figure(body, look, x=0., y=0., turn=0.):
    """A dressed body standing at (x, y), turned about Z. Returns all its objects."""
    objects = dz.load(os.path.join(dz.MODELS, body + '.glb'))
    objects += dz.dress(objects, body, look, MODELS)
    root = bpy.data.objects.new('%s %s' % (body, look), None)
    scene.collection.objects.link(root)
    for o in objects:
        if not o.parent:
            o.parent = root
    root.location = (x, y, 0)
    root.rotation_euler.z = turn
    return objects + [root]


def aim(target, direction, scale, width, height):
    camera.data.ortho_scale = scale
    camera.location = Vector(target) + Vector(direction).normalized() * 30
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = width, height


if REVIEW:
    for row, body in enumerate(dz.BODIES):
        for i, look in enumerate(dz.LOOKS):
            figure(body, look, i * 1.25, row * 3.2)
            figure(body, look, i * 1.25 + 8.9, row * 3.2, math.pi * .8)
    bpy.ops.mesh.primitive_plane_add(size=80)
    aim((8.2, 1.6, 1.0), (-.25, -1, .55), 18.6, 2400, 900)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = REVIEW
    bpy.ops.render.render(write_still=True)
else:
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.quality = 88
    aim((0, 0, .99), (-.42, -1, .34), 2.08, SIZE, SIZE)
    for body in dz.BODIES:
        for look in dz.LOOKS:
            objects = figure(body, look)
            scene.render.filepath = os.path.join(OUT, 'look-%s-%s.webp' % (body, look))
            bpy.ops.render.render(write_still=True)
            for o in objects:
                bpy.data.objects.remove(o, do_unlink=True)
    print('LOOK ICONS', len(dz.BODIES) * len(dz.LOOKS))
