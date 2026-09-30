"""Render the touch-control, settings and menu icons (transparent PNGs).

Run: .tools/blender-4.5.3-windows-x64/blender.exe -b --factory-startup --python-exit-code 1 --python art/build_hud_icons.py

Chunky, extruded emblems in the Nightfall kit: vivid warm colours over a dark
backing silhouette, so each icon still reads at 32 px on a busy battlefield.
The page draws them as CSS backgrounds inside CSS-built buttons, keeping text
and frames crisp at any screen density.
"""
import bpy, bmesh, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('NIGHTFALL_UI_OUT') or os.path.join(ROOT, 'public', 'ui')
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
bg.inputs[1].default_value = .6


def light(name, rot, energy, color):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.color = color
    data.angle = .2
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot]


light('Warm key', (48, 0, -38), 3.8, (1, .93, .8))
light('Cool fill', (62, 0, 150), 1.3, (.7, .82, 1))
light('Rim', (-60, 0, 20), 2.4, (1, 1, 1))
camera = bpy.data.objects.new('Icon camera', bpy.data.cameras.new('Icon camera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.lens = 70

K = style.Kit()
M = {
    'outline': K.mat('Icon outline', '#141a20', .6, ramp=None),
    'red': K.mat('Icon signal red', '#ff4b2b', .35, .1, ramp=(.82, 1.0)),
    'orange': K.mat('Icon hot orange', '#ff8a1f', .35, .1, ramp=(.82, 1.0)),
    'amber': K.mat('Icon amber', '#ffc21f', .3, .15, ramp=(.84, 1.0)),
    'yellow': K.mat('Icon yellow', '#ffe14d', .3, .1, ramp=(.86, 1.0)),
    'cyan': K.mat('Icon cyan', '#2fe0ff', .3, .1, ramp=(.82, 1.0)),
    'white': K.mat('Icon white', '#fff6e2', .35, ramp=(.86, 1.0)),
    'steel': K.mat('Icon steel', '#b9c6cf', .3, .7, ramp=(.8, 1.0)),
    'gunmetal': K.mat('Icon gunmetal', '#39434b', .4, .5),
    'brass': K.mat('Icon brass', '#f2b134', .3, .9, ramp=(.8, 1.0)),
    'green': K.mat('Icon green', '#46d45a', .4, ramp=(.82, 1.0)),
    'sky': K.mat('Icon sky blue', '#3fa7ff', .35, ramp=(.82, 1.0)),
    'leather': K.mat('Icon leather', '#b5562a', .6),
    'paper': K.mat('Icon paper', '#f1e6c8', .8, ramp=(.86, 1.0)),
}
DEPTH = .22


def flat(name, points, material, depth=DEPTH, y=0.0, bevel=.05):
    """Extrude a front-facing (x, z) outline toward the camera (-Y)."""
    o = K.prism(name, points, depth, material, loc=(0, y, 0), axis='Y', bevel=bevel, segments=2)
    return o


def backed(name, points, material, grow=1.14, depth=DEPTH):
    """Coloured shape over a slightly larger dark backing: reads on any ground."""
    cx = sum(p[0] for p in points) / len(points)
    cz = sum(p[1] for p in points) / len(points)
    back = [(cx + (x - cx) * grow, cz + (z - cz) * grow) for x, z in points]
    flat(name + ' outline', back, M['outline'], depth * .7, depth * .45, .03)
    return flat(name, points, material, depth)


def arc(name, radius, thickness, start, sweep, material, y=0.0, segments=28):
    """Flat ring segment in the XZ plane (angles in degrees, 0 = +X, CCW)."""
    pts_out, pts_in = [], []
    for i in range(segments + 1):
        a = math.radians(start + sweep * i / segments)
        pts_out.append((math.cos(a) * (radius + thickness / 2), math.sin(a) * (radius + thickness / 2)))
        pts_in.append((math.cos(a) * (radius - thickness / 2), math.sin(a) * (radius - thickness / 2)))
    return flat(name, pts_out + pts_in[::-1], material, DEPTH, y)


def annulus(name, radius, thickness, material, y=0.0, depth=DEPTH, segments=48):
    """A closed flat ring facing the camera: two loops joined by quads, so it
    has no keyhole seam (a 360-degree arc() polygon would)."""
    bm = bmesh.new()
    outer, inner = [], []
    for i in range(segments):
        a = i * math.tau / segments
        for loop, r in ((outer, radius + thickness / 2), (inner, radius - thickness / 2)):
            loop.append(bm.verts.new((math.cos(a) * r, y - depth / 2, math.sin(a) * r)))
    faces = [bm.faces.new((outer[i], outer[(i + 1) % segments], inner[(i + 1) % segments], inner[i]))
             for i in range(segments)]
    ext = bmesh.ops.extrude_face_region(bm, geom=faces)
    bmesh.ops.translate(bm, vec=Vector((0, depth, 0)),
                        verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('Soft bevel', 'BEVEL')
    mod.width = .04
    mod.segments = 2
    mod.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return K.finish(o, name, material)


def arrow_head(name, tip, direction, size, material, y=0.0):
    dx, dz = direction
    n = math.hypot(dx, dz)
    dx, dz = dx / n, dz / n
    px, pz = -dz, dx
    base = (tip[0] - dx * size, tip[1] - dz * size)
    return flat(name, [tip, (base[0] + px * size * .7, base[1] + pz * size * .7),
                       (base[0] - px * size * .7, base[1] - pz * size * .7)], material, DEPTH, y)


def ring_disc(name, radius, material, y=0.0, depth=DEPTH, vertices=40):
    o = K.cyl(name, (0, y, 0), radius, depth, material, 'Y', vertices, .04)
    return o


# ------------------------------------------------------------------ icons
def fire():
    annulus('Reticle ring', .8, .26, M['red'])
    for a in range(4):
        ang = a * math.pi / 2
        c, s = math.cos(ang), math.sin(ang)
        p = [(c * .5 - s * .09, s * .5 + c * .09), (c * 1.08 - s * .09, s * 1.08 + c * .09),
             (c * 1.08 + s * .09, s * 1.08 - c * .09), (c * .5 + s * .09, s * .5 - c * .09)]
        flat('Reticle tick', p, M['white'])
    K.cyl('Reticle dot', (0, -.02, 0), .17, DEPTH * 1.2, M['yellow'], 'Y', 20, .04)


def reload_():
    arc('Reload arrow', .78, .24, 70, 290, M['amber'], segments=40)
    a = math.radians(70)
    tip_dir = (-math.sin(a), math.cos(a))
    arrow_head('Reload arrowhead', (math.cos(a) * .78 + tip_dir[0] * .1, math.sin(a) * .78 + tip_dir[1] * .1),
               (-tip_dir[0], -tip_dir[1]), .36, M['amber'])
    K.cyl('Bullet case', (0, -.03, -.12), .17, .5, M['brass'], 'Z', 20, .03)
    K.cyl('Bullet tip', (0, -.03, .26), .17, .28, M['orange'], 'Z', 20, .02, radius2=.03)


def swap():
    for z, sign, mat in ((.34, 1, M['yellow']), (-.34, -1, M['cyan'])):
        flat('Swap shaft', [(-.62 * sign, z - .1), (.35 * sign, z - .1), (.35 * sign, z + .1), (-.62 * sign, z + .1)],
             mat)
        arrow_head('Swap arrowhead', (.78 * sign, z), (sign, 0), .42, mat)


def dodge():
    for x in (-.32, .2):
        flat('Dash chevron', [(x - .28, .62), (x + .08, .62), (x + .5, 0), (x + .08, -.62), (x - .28, -.62), (x + .14, 0)],
             M['cyan'])
    for z in (.4, 0, -.4):
        flat('Speed line', [(-.95, z - .05), (-.62, z - .05), (-.62, z + .05), (-.95, z + .05)], M['white'], DEPTH * .8)


def turbo():
    shape = [(.15, 1.0), (-.52, -.05), (-.06, -.05), (-.28, -1.0), (.52, .18), (.06, .18), (.36, 1.0)]
    flat('Turbo bolt', shape, M['yellow'], DEPTH * 1.2)


def blast():
    for r1, r2, mat, depth in ((.98, .5, M['orange'], DEPTH), (.62, .3, M['yellow'], DEPTH * 1.3)):
        pts = []
        for i in range(24):
            a = math.pi / 2 + i * math.pi / 12
            r = r1 if i % 2 == 0 else r2
            pts.append((math.cos(a) * r * (1.0 if i % 4 else .9), math.sin(a) * r))
        flat('Blast burst', pts, mat, depth)


def use():
    annulus('Steering rim', .72, .26, M['cyan'])
    K.cyl('Steering hub', (0, -.02, 0), .26, DEPTH * 1.3, M['orange'], 'Y', 24, .05)
    for ang in (90, 210, 330):
        a = math.radians(ang)
        c, s = math.cos(a), math.sin(a)
        flat('Steering spoke', [(c * .2 - s * .12, s * .2 + c * .12), (c * .66 - s * .12, s * .66 + c * .12),
                                (c * .66 + s * .12, s * .66 - c * .12), (c * .2 + s * .12, s * .2 - c * .12)],
             M['white'])


def sound():
    backed('Speaker box', [(-.75, -.3), (-.35, -.3), (-.35, .3), (-.75, .3)], M['amber'])
    backed('Speaker cone', [(-.35, -.3), (.05, -.72), (.05, .72), (-.35, .3)], M['orange'])
    for r in (.42, .74):
        arc('Sound wave', r, .15, -45, 90, M['white'], segments=16).location.x += .2


def music():
    for x, z in ((-.52, -.55), (.42, -.35)):
        head = K.sphere('Note head', (x, 0, z), (.3, .2, .22), M['amber'], 18, 10)
        head.rotation_euler = (0, math.radians(-20), 0)
        flat('Note stem', [(x + .2, z), (x + .32, z), (x + .32, z + 1.05), (x + .2, z + 1.05)], M['amber'])
    flat('Note beam', [(-.32, .5), (.74, .7), (.74, .92), (-.32, .72)], M['orange'], DEPTH * 1.1)


def graphics():
    backed('Monitor frame', [(-.95, -.55), (.95, -.55), (.95, .7), (-.95, .7)], M['gunmetal'])
    flat('Screen sky', [(-.8, -.42), (.8, -.42), (.8, .57), (-.8, .57)], M['sky'], DEPTH, -.05)
    flat('Screen hill', [(-.8, -.42), (.8, -.42), (.8, -.1), (.2, .3), (-.25, -.05), (-.8, .2)], M['green'], DEPTH, -.08)
    K.cyl('Screen sun', (.45, -.1, .3), .14, DEPTH, M['yellow'], 'Y', 18)
    flat('Monitor stand', [(-.18, -.55), (.18, -.55), (.3, -.85), (-.3, -.85)], M['gunmetal'])


def motion():
    backed('Camera body', [(-.85, -.45), (.45, -.45), (.45, .45), (-.85, .45)], M['gunmetal'])
    flat('Camera lens hood', [(.45, -.2), (.95, -.45), (.95, .45), (.45, .2)], M['steel'])
    K.cyl('Camera lens', (-.2, -.05, 0), .3, DEPTH * 1.2, M['cyan'], 'Y', 24, .04)
    K.cyl('Camera reel', (-.55, 0, .7), .28, DEPTH, M['amber'], 'Y', 24, .04)
    K.cyl('Camera reel', (.05, 0, .7), .28, DEPTH, M['amber'], 'Y', 24, .04)


def gear():
    pts = []
    teeth = 8
    for i in range(teeth * 4):
        a = i * math.tau / (teeth * 4)
        r = 1.0 if (i % 4) in (1, 2) else .78
        pts.append((math.cos(a) * r, math.sin(a) * r))
    flat('Gear outline', [(x * 1.08, z * 1.08) for x, z in pts], M['outline'], DEPTH * .7, DEPTH * .45, .03)
    flat('Gear', pts, M['steel'])
    K.cyl('Gear hub', (0, -.03, 0), .34, DEPTH * 1.2, M['orange'], 'Y', 24, .04)
    K.cyl('Gear hole', (0, -.1, 0), .16, DEPTH * 1.3, M['outline'], 'Y', 20)


def manual():
    backed('Book cover', [(-.8, -.95), (.75, -.95), (.75, .95), (-.8, .95)], M['leather'])
    flat('Book pages', [(.75, -.88), (.88, -.8), (.88, .88), (.75, .95)], M['paper'], DEPTH * .9)
    flat('Book spine band', [(-.8, -.95), (-.55, -.95), (-.55, .95), (-.8, .95)], M['outline'], DEPTH * 1.1)
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = .42 if i % 2 == 0 else .18
        pts.append((.1 + math.cos(a) * r, .1 + math.sin(a) * r))
    flat('Book star', pts, M['amber'], DEPTH * 1.25)


def render(name, build, view=(0.08, -1, 0.22), pad=1.12):
    before = set(bpy.data.objects)
    build()
    objects = [o for o in bpy.data.objects if o not in before]
    K.current = []
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
    for o in objects:
        bpy.data.objects.remove(o, do_unlink=True)


# Control glyphs sit inside dark round CSS buttons: fill the frame.
for name, build in (('hud-fire', fire), ('hud-reload', reload_), ('hud-swap', swap), ('hud-dodge', dodge),
                    ('hud-turbo', turbo), ('hud-blast', blast), ('hud-use', use)):
    render(name, build, pad=1.02)
render('set-sound', sound)
render('set-music', music)
render('set-graphics', graphics)
render('set-motion', motion)
render('menu-settings', gear)
render('menu-manual', manual)
print('HUD ICONS', sorted(n for n in os.listdir(OUT) if n.startswith(('hud-', 'set-', 'menu-'))))
