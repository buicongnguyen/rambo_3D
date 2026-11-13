"""Nightfall disguises: outfits the hero (commando or commandoWoman) wears over the rig.

Run: .tools/blender-4.5.3-windows-x64/blender.exe -b --factory-startup --python-exit-code 1 --python art/build_disguises.py

One file, public/models/disguises.glb. Each outfit is a root `dz_<id>` whose children
`dz_<id>@<Joint>` sit at the commando's joint, so their meshes are in joint space and
src/wardrobe.ts can hang them on either body's joint of that name.

Contracts (see src/wardrobe.ts and tests/disguises.test.mjs):
- root extras: `tints` (JSON, body material name -> sRGB hex, the way liveries.ts
  recolours) and `hide` ("Joint:Material|..." body parts the outfit replaces);
- piece extras: `wear` (joint name) and `fit` (scale that takes the piece from the
  commando's build to the commandoWoman's, in three.js axes);
- pieces are modelled around the commando in soldier() of build_assets.py: hats clear
  his hair and headband, and anything on the back assumes the pack is hidden.
Blender is Z-up with -Y forward; glTF export turns that into three.js +Y up / +Z forward.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('NIGHTFALL_MODELS_OUT') or os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

K = style.Kit()
box, tbox, sphere, cyl, limb, rod, at = K.box, K.tbox, K.sphere, K.cyl, K.limb, K.rod, K.attach
# The commando's joints (soldier() in build_assets.py).
JOINTS = {'Head': (0, 0, 1.48), 'Spine': (0, 0, .95), 'Hips': (0, 0, .88)}
for side, s in (('L', -1), ('R', 1)):
    JOINTS['Arm' + side] = (s * .36, 0, 1.39)
    JOINTS['Forearm' + side] = (s * .36, -.2, 1.12)
    JOINTS['Thigh' + side] = (s * .17, 0, .87)
    JOINTS['Shin' + side] = (s * .17, 0, .48)
# commandoWoman is slighter: (x, y, z) scale of a piece about its joint, Blender axes.
WOMAN = {'Head': (.97, .97, .97), 'Spine': (.78, .84, 1), 'Hips': (.95, 1.05, 1), 'Arm': (.8, .8, 1),
         'Forearm': (.85, .85, .85), 'Thigh': (.87, .87, 1), 'Shin': (.86, .86, 1)}
HEIGHT = 1.9  # the painted-light ramp spans the body, so outfits shade like the rig

M = {name: K.mat('Disguise ' + name, colour, *rest) for name, colour, *rest in (
    ('black', '#1c1d24', .5), ('white', '#f4f6f9', .6), ('gold', '#f2bb2e', .3, .85), ('bone', '#f3ecd8', .7),
    ('crimson', '#8c1820', .7), ('sash', '#f2c230', .6), ('navy', '#1d3f94', .6), ('red', '#e0262b', .55),
    ('steel', '#aab6c2', .32, .8), ('royal', '#2748b8', .55), ('plume', '#e0262b', .7),
    ('silk', '#e23d6d', .5), ('straw', '#ecd28c', .85), ('straw band', '#b98f4a', .85),
    ('flag red', '#da251d', .6), ('flag star', '#ffcd00', .45),
    ('robot', '#eef2f6', .35, .3), ('robot blue', '#2a6fe0', .4, .3), ('robot dark', '#27324a', .5, .4),
)}
M['visor'] = K.mat('Disguise visor', '#35e6ff', .2, emit=2.2)
M['flame'] = K.mat('Disguise flame', '#ff8a1f', .3, emit=2.4)
outfits = {}


def outfit(name, tints, hide=()):
    root = bpy.data.objects.new('dz_' + name, None)
    bpy.context.collection.objects.link(root)
    root['tints'] = json.dumps(tints)
    root['hide'] = '|'.join(hide)
    K.current.append(root)
    outfits[name] = {'root': root, 'wear': {}}
    return name


def on(name, joint_name, *objects):
    """Hang pieces on a joint of the outfit (one export node per joint)."""
    wear = outfits[name]['wear']
    if joint_name not in wear:
        o = bpy.data.objects.new('dz_%s@%s' % (name, joint_name), None)
        bpy.context.collection.objects.link(o)
        o.location = JOINTS[joint_name]
        o.parent = outfits[name]['root']
        x, y, z = WOMAN[joint_name.rstrip('LR')]
        o['wear'] = joint_name
        o['fit'] = [x, z, y]
        K.current.append(o)
        wear[joint_name] = o
    for o in objects:
        at(o, wear[joint_name])


def slab(name, loc, size, material, rot=None):
    """Hard-edged flat-shaded box (12 triangles) for trims, straps and panels."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = size
    K._apply(o)
    if rot:
        o.rotation_euler = rot
    return K.finish(o, name, material, smooth=False)


def dome(name, loc, radii, material, cut=0., segments=14, rings=8):
    """Sphere open below `cut` (a fraction of its height radius): hats and helmets."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    o = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut - 1e-4], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.scale = radii
    K._apply(o)
    return K.finish(o, name, material, weighted=False)


def tube(name, a, b, r1, r2, material, vertices=8):
    """Plain tapered tube from a to b: armour shells that need no rounded ends."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return K.finish(o, name, material)


def star(name, loc, outer, inner, depth, material, points=5):
    """Flat star facing -Y/+Y, one point up."""
    profile = []
    for i in range(points * 2):
        a = i * math.pi / points
        r = outer if i % 2 == 0 else inner
        profile.append((math.sin(a) * r, math.cos(a) * r))
    o = K.prism(name, profile, depth, material, loc, axis='Y', bevel=0)
    for poly in o.data.polygons:
        poly.use_smooth = False
    return o


# ================================================================ pirate
def pirate():
    n = outfit('pirate', {'Hero fatigues': '#b3212b', 'Hero vest': '#23263a', 'Webbing tan': '#8a5a2b',
                          'Tied jacket olive': '#b3212b'})
    on(n, 'Head',
       dome('Tricorn crown', (0, .01, 1.7), (.236, .236, .2), M['black'], 0, 12, 6),
       cyl('Tricorn brim', (0, .01, 1.725), .31, .028, M['black'], 'Z', 14),
       slab('Brim back', (0, .27, 1.78), (.42, .03, .13), M['black'], (.5, 0, 0)),
       slab('Gold edge back', (0, .238, 1.838), (.43, .034, .024), M['gold'], (.5, 0, 0)),
       sphere('Skull', (0, -.226, 1.8), (.05, .03, .05), M['bone'], 8, 5),
       slab('Eye patch', (-.058, -.178, 1.67), (.066, .022, .056), M['black']))
    for s in (-1, 1):
        on(n, 'Head',
           slab('Brim side', (s * .215, -.055, 1.78), (.03, .5, .13), M['black'], (0, -s * .5, s * .5)),
           slab('Gold edge side', (s * .187, -.04, 1.838), (.034, .51, .024), M['gold'], (0, -s * .5, s * .5)),
           slab('Crossbone', (0, -.236, 1.79), (.15, .014, .024), M['bone'], (0, s * .6, 0)))
        on(n, 'Arm' + 'LR'[s > 0], box('Epaulette', (s * .37, 0, 1.495), (.2, .22, .045), M['gold'], .015, 1))
        on(n, 'Hips', slab('Coat tail', (s * .125, .175, .6), (.22, .035, .52), M['crimson'], (-.1, 0, s * .06)))
        on(n, 'Shin' + 'LR'[s > 0], cyl('Boot cuff', (s * .17, -.01, .31), .125, .1, M['black'], 'Z', 10, radius2=.14))
    on(n, 'Hips',
       box('Waist sash', (0, 0, .955), (.48, .315, .1), M['sash'], .03, 1),
       sphere('Sash knot', (-.2, -.13, .95), (.06, .045, .055), M['sash'], 8, 5),
       slab('Sash tail', (-.2, -.165, .8), (.075, .02, .28), M['sash'], (0, .12, 0)))


# ================================================================== navy
def navy():
    n = outfit('navy', {'Hero fatigues': '#f4f6f9', 'Hero vest': '#1d3f94', 'Webbing tan': '#f4f6f9',
                        'Tied jacket olive': '#1d3f94'},
               ('Spine:Webbing tan', 'Spine:Gunmetal', 'Spine:Boot leather', 'Spine:Brass'))
    on(n, 'Head',
       cyl('Cap band', (0, .01, 1.765), .234, .1, M['navy'], 'Z', 14),
       cyl('Cap top', (0, .01, 1.85), .285, .085, M['white'], 'Z', 14, .03),
       slab('Cap badge', (0, -.231, 1.77), (.07, .02, .055), M['gold']),
       slab('Cap ribbon', (.05, .26, 1.69), (.05, .012, .16), M['navy'], (-.25, 0, .2)),
       slab('Cap ribbon', (-.05, .26, 1.69), (.05, .012, .16), M['navy'], (-.25, 0, -.2)))
    on(n, 'Spine',
       box('Sailor collar', (0, .185, 1.36), (.48, .03, .24), M['navy'], .012, 1),
       slab('Collar stripe', (0, .203, 1.27), (.44, .012, .022), M['white']),
       box('Neckerchief knot', (0, -.212, 1.21), (.075, .045, .065), M['red'], .02, 1))
    for s in (-1, 1):
        on(n, 'Spine',
           slab('Collar front', (s * .095, -.2, 1.33), (.06, .02, .3), M['navy'], (0, s * .42, 0)),
           slab('Neckerchief tail', (s * .035, -.215, 1.12), (.045, .016, .15), M['red'], (0, -s * .28, 0)))


# ================================================================ knight
def knight():
    n = outfit('knight', {'Hero fatigues': '#9aa7b4', 'Hero vest': '#2748b8', 'Webbing tan': '#e3b63c',
                          'Boot leather': '#565f6b', 'Tied jacket olive': '#2748b8'},
               ('Spine:Webbing tan', 'Spine:Gunmetal', 'Spine:Boot leather', 'Spine:Brass'))
    on(n, 'Head',
       dome('Helm', (0, .008, 1.69), (.24, .242, .222), M['steel'], 0, 14, 6),
       cyl('Helm rim', (0, .008, 1.7), .246, .04, M['gold'], 'Z', 14),
       slab('Nasal bar', (0, -.236, 1.66), (.036, .02, .14), M['steel']),
       box('Helm crest', (0, .02, 1.905), (.035, .34, .05), M['gold'], .012, 1),
       tube('Plume', (0, .04, 1.96), (0, .36, 1.83), .062, .02, M['plume'], 6),
       tbox('Neck guard', (0, .2, 1.6), (.3, .05), (.36, .06), .2, M['steel'], .015, 1))
    for s in (-1, 1):
        side = 'LR'[s > 0]
        on(n, 'Head', slab('Cheek guard', (s * .215, -.05, 1.6), (.03, .16, .18), M['steel']))
        on(n, 'Arm' + side, dome('Pauldron', (s * .365, 0, 1.4), (.155, .16, .12), M['steel'], -.2, 10, 6),
           cyl('Pauldron stud', (s * .365, 0, 1.52), .035, .03, M['gold'], 'Z', 6))
        on(n, 'Shin' + side, sphere('Knee cop', (s * .17, -.09, .48), (.098, .06, .092), M['gold'], 8, 5))
    on(n, 'Spine',
       star('Sun crest', (0, -.2, 1.25), .13, .075, .03, M['gold'], 8),
       cyl('Shield', (0, .215, 1.2), .3, .05, M['royal'], 'Y', 14, .015, segments=1),
       cyl('Shield rim', (0, .212, 1.2), .31, .03, M['gold'], 'Y', 14),
       sphere('Shield boss', (0, .245, 1.2), (.085, .04, .085), M['gold'], 8, 5))


# ================================================================= ao dai
def aodai():
    n = outfit('aodai', {'Hero fatigues': '#f7f2e8', 'Hero vest': '#e23d6d', 'Webbing tan': '#f7f2e8',
                         'Boot leather': '#efe2c8', 'Tied jacket olive': '#e23d6d'},
               ('Spine:Webbing tan', 'Spine:Gunmetal', 'Spine:Boot leather', 'Spine:Brass'))
    on(n, 'Head',
       cyl('Non la', (0, .01, 1.855), .41, .25, M['straw'], 'Z', 16, radius2=.012),
       cyl('Hat band', (0, .01, 1.745), .222, .05, M['straw band'], 'Z', 12))
    on(n, 'Spine',
       cyl('High collar', (0, 0, 1.47), .105, .06, M['silk'], 'Z', 10),
       star('Gold blossom', (-.11, -.196, 1.3), .05, .024, .02, M['gold'], 6),
       star('Gold blossom', (-.03, -.196, 1.2), .034, .016, .02, M['gold'], 6))
    for y in (-.165, .165):
        on(n, 'Hips',
           tbox('Tunic panel', (0, y, .6), (.37, .032), (.43, .032), .62, M['silk'], .012, 1),
           slab('Gold hem', (0, y, .31), (.435, .038, .03), M['gold']))
    for s in (-1, 1):
        on(n, 'Arm' + 'LR'[s > 0], sphere('Silk sleeve', (s * .348, 0, 1.36), (.137, .142, .13), M['silk'], 10, 6))


# ============================================================ golden star
def vietnam():
    n = outfit('vietnam', {'Hero fatigues': '#da251d', 'Hero vest': '#b81c16', 'Webbing tan': '#ffcd00',
                           'Hero bandana': '#ffcd00', 'Tied jacket olive': '#b81c16'},
               ('Spine:Webbing tan', 'Spine:Gunmetal', 'Spine:Boot leather', 'Spine:Brass'))
    on(n, 'Head', star('Band star', (0, -.222, 1.722), .055, .024, .02, M['flag star']))
    on(n, 'Spine',
       star('Chest star', (0, -.2, 1.25), .135, .054, .03, M['flag star']),
       tbox('Flag cape', (0, .225, 1.0), (.5, .03), (.72, .03), .9, M['flag red'], .012, 1, shift=(0, -.05)),
       star('Cape star', (0, .235, 1.02), .2, .08, .03, M['flag star']),
       slab('Cape clasp', (0, .12, 1.465), (.4, .16, .03), M['flag star']))


# ================================================================== mecha
def mecha():
    n = outfit('mecha', {'Hero fatigues': '#eef2f6', 'Hero vest': '#2a6fe0', 'Webbing tan': '#1c3f94',
                         'Boot leather': '#27406e', 'Hero bandana': '#2a6fe0', 'Tied jacket olive': '#2a6fe0'},
               ('Spine:Webbing tan', 'Spine:Gunmetal', 'Spine:Boot leather', 'Spine:Brass'))
    on(n, 'Head',
       sphere('Robot helmet', (0, -.005, 1.68), (.238, .255, .238), M['robot'], 14, 8),
       box('Visor', (0, -.2, 1.69), (.32, .14, .1), M['visor'], .035, 1),
       box('Helmet fin', (0, .02, 1.91), (.045, .3, .07), M['robot blue'], .015, 1),
       rod('Antenna', (.12, .05, 1.86), (.15, .08, 2.08), .012, M['robot dark'], 5),
       slab('Antenna tip', (.152, .082, 2.09), (.04, .04, .04), M['flame']))
    on(n, 'Spine',
       cyl('Core ring', (0, -.195, 1.27), .1, .03, M['robot dark'], 'Y', 12),
       cyl('Core', (0, -.205, 1.27), .07, .03, M['visor'], 'Y', 10))
    for s in (-1, 1):
        side = 'LR'[s > 0]
        on(n, 'Head', cyl('Ear disc', (s * .24, 0, 1.68), .075, .05, M['robot blue'], 'X', 10))
        on(n, 'Spine',
           cyl('Jet tank', (s * .115, .25, 1.22), .09, .36, M['robot'], 'Z', 10, .025, segments=1),
           cyl('Jet nozzle', (s * .115, .25, 1.0), .075, .08, M['robot dark'], 'Z', 8, radius2=.045),
           cyl('Jet flame', (s * .115, .25, .9), .001, .15, M['flame'], 'Z', 6, radius2=.045))
        on(n, 'Arm' + side,
           box('Shoulder armour', (s * .375, 0, 1.42), (.2, .25, .17), M['robot'], .045, 1),
           slab('Shoulder stripe', (s * .375, 0, 1.512), (.07, .255, .012), M['robot blue']))
        elbow = Vector(JOINTS['Forearm' + side])
        hand = Vector((.29, -.47, 1.15) if s > 0 else (-.02, -.52, 1.17))
        on(n, 'Forearm' + side, tube('Gauntlet', elbow.lerp(hand, .12), elbow.lerp(hand, .78), .1, .088, M['robot']))
        on(n, 'Shin' + side, tube('Shin armour', (s * .17, -.03, .25), (s * .17, -.02, .46), .108, .124, M['robot']))


# ================================================================== build
for build in (pirate, navy, knight, aodai, vietnam, mecha):
    build()

groups, objects = {}, []
for o in K.current:
    if o.type == 'MESH':
        groups.setdefault(o.parent.name, []).append(o)
    else:
        objects.append(o)
# One mesh per joint of each outfit (one glTF primitive per material).
for meshes in groups.values():
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    if len(meshes) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
    objects.append(meshes[0])
K.paint_height(objects, 0, HEIGHT)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
path = os.path.join(OUT, 'disguises.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                          export_extras=True, export_apply=True)
for i, name in enumerate(outfits):
    outfits[name]['root'].location.x += i * 1.5
if not os.environ.get('NIGHTFALL_MODELS_OUT'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'disguises.blend'))
tris = sum(len(p.vertices) - 2 for o in objects if o.type == 'MESH' for p in o.data.polygons)
print('EXPORTED', len(outfits), 'disguises,', tris, 'triangles,', os.path.getsize(path), 'bytes')
