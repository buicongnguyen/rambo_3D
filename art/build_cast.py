"""Nightfall reinforcement cast in the shared stylized kit (style.py).

Builds: captiveWoman / commandoWoman (women prisoners and the allies they become),
ninja infantry and its katana, the ammunition box enemies drop, and two late-stage
command bosses adapted from Steel Front: the SKY WRAITH attack helicopter and the
IRON SOVEREIGN six-legged walker.

Run: .tools/blender-4.5.3-windows-x64/blender.exe -b --factory-startup --python-exit-code 1 --python art/build_cast.py

Contracts (see tests/assets.test.mjs and src/game.ts):
- characters keep the commando/rifleman joint hierarchy (Motion, Hips, Spine, Head,
  Arm/Forearm/Thigh/Shin L+R, and Weapon on armed rigs) with identity rest rotation;
- commandoWoman wears the "Hero bandana" material that liveries.ts turns ally cyan;
- skyWraith exposes Rotor, TailRotor, AuxGun/MuzzleAux and Launch0/Launch1;
- walker exposes Leg0-Leg5, Vent0/Vent1 and Muzzle0-Muzzle2.
Blender is Z-up with -Y forward; glTF export turns that into three.js +Y up / +Z forward.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import style, boss_assets

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('NIGHTFALL_MODELS_OUT') or os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

K = style.Kit()
box, tbox, sphere, cyl, limb, rod, prism = K.box, K.tbox, K.sphere, K.cyl, K.limb, K.rod, K.prism
joint, at, mat = K.joint, K.attach, K.mat
P = style.PALETTE
M = {
    'hero': mat('Hero fatigues', P['hero_green'], .72),
    'hero_vest': mat('Hero vest', P['hero_green_dark'], .66),
    'webbing': mat('Webbing tan', P['webbing'], .7),
    'bandana': mat('Hero bandana', P['bandana'], .55),
    'ivory': mat('Rescue ivory', P['ivory'], .8),
    'ally': mat('Ally cyan', P['cyan'], .35, emit=.6),
    'skin': mat('Warm skin', P['skin'], .62),
    'boot': mat('Boot leather', '#3d2b1f', .6),
    'eye': mat('Eye dark', '#140f0c', .25, ramp=None),
    'glint': mat('Eye glint', '#ffffff', .2, emit=.8, ramp=None),
    'rubber': mat('Rubber', P['rubber'], .86),
    'gunmetal': mat('Gunmetal', P['gunmetal'], .38, .55),
    'steel': mat('Bright steel', P['steel'], .3, .85),
    'brass': mat('Brass', P['brass'], .3, .9),
    'hazard': mat('Hazard yellow', P['hazard'], .45),
    'dark': mat('Shadow interior', '#161a1c', .9, ramp=None),
    'glass': mat('Smoked teal', P['teal_glass'], .08, .2, ramp=(.55, 1.0)),
    'drum_red': mat('Signal rust', '#d8281c', .35, .25),
    # Women: warm auburn hair and rose lips so they read at gameplay distance.
    'auburn': mat('Auburn hair', '#7a3218', .7),
    'lips': mat('Rose lips', '#c9505e', .45),
    'blush': mat('Cheek blush', '#e98a78', .6),
    'brow': mat('Brow brown', '#3a1c10', .7),
    'rope': mat('Hemp rope', '#b58a52', .9),
    'shoe': mat('Cloth shoe', '#9c8f73', .85),
    'jacket': mat('Tied jacket olive', '#6f8d34', .75),
    # Ninja: deep indigo (not flat black, so the painted light still shapes it) and crimson.
    'gi': mat('Ninja indigo', '#28305a', .7),
    'shade': mat('Ninja shadow', '#161b31', .75),
    'sash': mat('Ninja crimson', '#dc2a30', .5),
    'wrap': mat('Ninja wraps', '#d8ceb4', .85),
    'lacquer': mat('Lacquer black', '#15161a', .25, .2),
    'gold': mat('Gold fitting', '#e6b73e', .3, .85),
}
assets = {}


def merge_static(objs):
    """Join each joint's static meshes into one object (one glTF primitive per
    material): about a third of the bytes and draw calls, same joints and look."""
    groups, out = {}, []
    for o in objs:
        if o.type == 'MESH':
            groups.setdefault(o.parent.name if o.parent else '', []).append(o)
        else:
            out.append(o)
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
        out.append(meshes[0])
    return out


def finish_asset(name):
    objs = K.export(os.path.join(OUT, name + '.glb'), merge_static(K.current))
    assets[name] = objs
    K.current = []
    return objs


def ring(name, loc, major, minor, material, scale=(1, 1, 1), rot=None, seg=(18, 6)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=seg[0],
                                     minor_segments=seg[1], location=loc)
    o = bpy.context.object
    o.scale = scale
    K._apply(o)
    if rot:
        o.rotation_euler = rot
    return K.finish(o, name, material)


def smile(name, loc, major, minor, material):
    """Lower half of a torus facing -Y: a U-shaped smile line."""
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=16, minor_segments=5,
                                     location=(0, 0, 0))
    o = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > major * .12], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.scale = (1, .45, 1)
    K._apply(o)
    o.rotation_euler = (math.pi / 2, 0, 0)
    o.location = loc
    return K.finish(o, name, material)


def plate(name, a, b, size, material, bevel=.06):
    """Box armour plate spanning a->b; `size` is (width, thickness)."""
    a, b = Vector(a), Vector(b)
    o = box(name, (a + b) / 2, (size[0], size[1], (b - a).length), material, bevel)
    o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return o


def tilt(o, rot):
    o.rotation_euler = rot
    return o


# ================================================================ women
def woman_head(head, captive):
    hair, band = M['auburn'], M['ally'] if captive else M['bandana']
    at(sphere('Neck', (0, 0, 1.49), (.07, .07, .08), M['skin'], 12, 6), head)
    at(sphere('Head', (0, -.01, 1.64), (.158, .154, .176), M['skin'], 16, 10), head)
    at(sphere('Soft jaw', (0, -.055, 1.55), (.092, .088, .064), M['skin'], 12, 6), head)
    at(sphere('Nose', (0, -.166, 1.622), (.019, .02, .024), M['skin'], 8, 5), head)
    at(smile('Smiling lips', (0, -.151, 1.6), .03, .0085, M['lips']), head)
    at(sphere('Lower lip', (0, -.151, 1.576), (.017, .008, .006), M['lips'], 8, 4), head)
    for s in (-1, 1):
        x = s * .055
        at(sphere('Eye', (x, -.147, 1.655), (.026, .013, .033), M['eye'], 10, 6), head)
        at(sphere('Eye glint', (x - s * .009, -.159, 1.667), (.008, .005, .009), M['glint'], 6, 4), head)
        # Thin upper lash line with a small outer flick; brows arch softly.
        at(box('Lash line', (x, -.15, 1.684), (.054, .012, .007), M['eye'], .002, 1), head)
        at(box('Lash flick', (x + s * .031, -.145, 1.689), (.018, .01, .006), M['eye'], .002, 1, rot=(0, -s * .7, 0)), head)
        at(box('Brow', (s * .058, -.146, 1.722), (.056, .01, .009), M['brow'], .003, 1, rot=(0, s * .1, 0)), head)
        at(sphere('Cheek blush', (s * .086, -.126, 1.605), (.03, .01, .018), M['blush'], 8, 4), head)
        at(sphere('Ear', (s * .158, 0, 1.64), (.025, .038, .048), M['skin'], 8, 4), head)
        at(sphere('Earring', (s * .162, -.005, 1.587), .011, M['brass'] if not captive else M['ally'], 6, 4), head)
        at(limb('Face-framing lock', (s * .147, -.07, 1.735), (s * .14, -.094, 1.54), .034, .014, hair), head)
    at(sphere('Hair crown', (0, .018, 1.676), (.172, .17, .162), hair, 16, 8), head)
    at(tilt(sphere('Swept fringe', (-.03, -.112, 1.752), (.12, .05, .042), hair, 10, 6), (0, .3, -.2)), head)
    at(tilt(sphere('Fringe tip', (.07, -.118, 1.738), (.06, .042, .034), hair, 8, 5), (0, -.25, .2)), head)
    at(ring('Headband', (0, .005, 1.716), .172, .025, band, (1.02, 1, 1)), head)
    if captive:
        # Low braid down the back: alternating plaits read as woven hair.
        at(ring('Braid tie', (0, .168, 1.585), .042, .014, band, rot=(1.25, 0, 0)), head)
        for i in range(6):
            z = 1.555 - i * .058
            r = .052 - i * .004
            at(sphere('Braid plait', ((-1) ** i * .012, .19 + i * .006, z), (r, r * .9, r * 1.05), hair, 8, 5), head)
        at(limb('Braid tail', (0, .23, 1.22), (0, .235, 1.14), .024, .006, hair), head)
    else:
        # High ponytail with a curl at the tip; the tie wears the bandana colour.
        at(ring('Hair tie', (0, .158, 1.765), .046, .017, band, rot=(1.05, 0, 0)), head)
        tail = [(0, .172, 1.772), (0, .275, 1.69), (0, .305, 1.55), (0, .28, 1.42), (.03, .22, 1.33)]
        radii = [.058, .074, .062, .042, .012]
        for i in range(4):
            at(limb('Ponytail', tail[i], tail[i + 1], radii[i], radii[i + 1], hair), head)
        for s in (-1, 1):
            at(box('Bandana tail', (s * .045, .198, 1.69), (.05, .028, .15), band, .012, rot=(-.55, s * .3, 0)), head)


def woman(name, captive):
    top = M['ivory'] if captive else M['hero_vest']
    legs = M['ivory'] if captive else M['hero']
    motion = joint(name + '_Motion', (0, 0, 0))
    hips = joint(name + '_Hips', (0, 0, .86), motion)
    at(tbox('Pelvis', (0, 0, .845), (.38, .25), (.37, .24), .24, legs, .09), hips)
    spine = joint(name + '_Spine', (0, 0, .95), motion)
    at(tbox('Waist', (0, 0, 1.05), (.33, .21), (.355, .232), .2, top, .07), spine)
    at(tbox('Chest', (0, 0, 1.25), (.43, .245), (.33, .21), .3, top, .09), spine)
    at(sphere('Bust', (0, -.074, 1.236), (.148, .08, .078), top, 12, 6), spine)
    if captive:
        # Loose prisoner tunic: flared skirt, torn zigzag hem, rope belt, short sleeves.
        at(tbox('Tunic skirt', (0, 0, .835), (.37, .25), (.46, .32), .26, top, .05), hips)
        for i in range(8):
            a = (i + .5) * math.tau / 8
            at(box('Torn hem', (math.sin(a) * .215, math.cos(a) * .15, .7), (.08, .08, .08), top, 0, 1,
                   rot=(math.pi / 4, 0, -a)), hips)
        at(box('Rope belt', (0, 0, .962), (.365, .245, .036), M['rope'], .014), hips)
        at(sphere('Rope knot', (.09, -.125, .955), .03, M['rope'], 8, 6), hips)
        for dx, z in ((.075, .86), (.11, .88)):
            at(limb('Rope end', (.09, -.13, .95), (dx, -.14, z), .012, .008, M['rope'], 6), hips)
    else:
        # Fitted tank top, dog tags, rifle sling and a jacket knotted round the hips.
        for s in (-1, 1):
            at(box('Tank strap', (s * .12, 0, 1.4), (.07, .25, .04), top, .015, 1), spine)
        at(rod('Dog tag chain', (-.06, -.1, 1.41), (.0, -.14, 1.3), .005, M['steel'], 4), spine)
        at(rod('Dog tag chain', (.06, -.1, 1.41), (.0, -.14, 1.3), .005, M['steel'], 4), spine)
        at(box('Dog tag', (0, -.147, 1.28), (.036, .01, .05), M['steel'], .006, 1), spine)
        at(box('Rifle sling', (0, -.03, 1.2), (.05, .3, .56), M['webbing'], .012, 1, rot=(0, .72, 0)), spine)
        at(box('Belt', (0, 0, .955), (.385, .258, .055), M['boot'], .02), hips)
        at(box('Belt buckle', (0, -.132, .955), (.075, .02, .048), M['brass'], .01), hips)
        for s in (-1, 1):
            at(box('Hip pouch', (s * .2, -.06, .93), (.07, .1, .1), M['webbing'], .02), hips)
        at(tbox('Tied jacket', (0, .02, .9), (.41, .28), (.43, .3), .1, M['jacket'], .03), hips)
        at(tbox('Jacket back flap', (0, .15, .74), (.38, .06), (.42, .08), .32, M['jacket'], .03), hips)
        for s in (-1, 1):
            at(limb('Jacket sleeve knot', (s * .19, -.1, .92), (s * .03, -.16, .88), .045, .035, M['jacket']), hips)
        at(sphere('Sleeve knot', (0, -.165, .87), (.05, .04, .045), M['jacket'], 8, 5), hips)
        at(limb('Hanging sleeve', (-.02, -.17, .86), (.05, -.17, .66), .035, .03, M['jacket']), hips)
    head = joint(name + '_Head', (0, 0, 1.47), spine)
    woman_head(head, captive)
    for side, x in (('L', -.305), ('R', .305)):
        s = 1 if x > 0 else -1
        arm = joint(name + '_Arm' + side, (x, 0, 1.37), spine)
        at(sphere('Shoulder', (x * .97, 0, 1.345), (.098, .1, .095), top if captive else M['skin'], 10, 6), arm)
        if captive:
            elbow, hand = (x * .95, -.07, 1.1), (s * .045, -.2, .985)
            at(limb('Short sleeve', (x, -.005, 1.35), (x * .99, -.03, 1.25), .088, .08, top), arm)
        else:
            elbow = (x * 1.02, -.17, 1.105)
            hand = (.275, -.455, 1.125) if side == 'R' else (-.03, -.5, 1.145)
        at(limb('Upper arm', (x, -.02, 1.33), elbow, .068, .058, M['skin']), arm)
        fore = joint(name + '_Forearm' + side, elbow, arm)
        at(limb('Forearm', elbow, hand, .058, .046, M['skin']), fore)
        if captive:
            at(sphere('Hand', hand, (.048, .056, .046), M['skin'], 10, 6), fore)
            if side == 'R':
                # Bound wrists: prisoners are freed at the blue prison door.
                at(ring('Wrist rope', (0, -.19, 1.0), .075, .02, M['rope'], (1, .6, .45)), fore)
        else:
            at(sphere('Fingerless glove', hand, (.05, .06, .048), M['boot'], 10, 6), fore)
            if side == 'L':
                at(cyl('Wrist watch', (x * .35, -.43, 1.14), .042, .03, M['gunmetal'], 'Y', 10), fore)
            else:
                joint(name + '_Weapon', (.27, -.48, 1.145), fore)
    for side, x in (('L', -.14), ('R', .14)):
        thigh = joint(name + '_Thigh' + side, (x, 0, .85), hips)
        at(limb('Thigh', (x, 0, .86), (x, -.01, .47), .116, .088, legs), thigh)
        if not captive:
            if side == 'L':
                at(box('Cargo pocket', (x * 1.75, -.01, .66), (.055, .16, .17), M['hero_vest'], .025), thigh)
            else:
                at(box('Thigh holster', (x * 1.72, -.02, .7), (.06, .13, .2), M['boot'], .025), thigh)
                at(box('Holstered pistol', (x * 1.74, -.02, .82), (.04, .09, .08), M['gunmetal'], .015), thigh)
        shin = joint(name + '_Shin' + side, (x, 0, .47), thigh)
        at(sphere('Knee', (x, -.035, .47), (.08, .07, .075), legs, 8, 5), shin)
        at(limb('Calf', (x, -.01, .5), (x, 0, .2), .088, .068, legs), shin)
        if captive:
            at(tbox('Cloth shoe', (x, -.045, .075), (.15, .2), (.17, .3), .13, M['shoe'], .05, shift=(0, .03)), shin)
        else:
            at(tbox('Boot', (x, -.045, .105), (.165, .22), (.185, .32), .2, M['boot'], .06, shift=(0, .03)), shin)
        at(box('Sole', (x, -.055, .02), (.19, .32, .04), M['rubber'], .014), shin)
    return finish_asset(name)


# ================================================================ ninja
def ninja():
    name = 'ninja'
    gi, shade, sash, wrap = M['gi'], M['shade'], M['sash'], M['wrap']
    motion = joint(name + '_Motion', (0, 0, 0))
    hips = joint(name + '_Hips', (0, 0, .88), motion)
    at(tbox('Pelvis', (0, 0, .86), (.44, .28), (.42, .27), .26, gi, .09), hips)
    at(box('Crimson sash', (0, 0, .975), (.47, .3, .1), sash, .03), hips)
    at(sphere('Sash knot', (-.17, -.13, .975), (.055, .045, .05), sash, 10, 6), hips)
    for dx, dz in ((-.21, .72), (-.13, .76)):
        at(box('Sash tail', ((-.17 + dx) / 2, -.15, (.975 + dz) / 2), (.05, .02, .26), sash, .01, 1,
               rot=(0, (dx + .17) * 2.2, 0)), hips)
    for x in (.09, .17):
        # Shuriken tucked into the sash.
        for a in (math.pi / 4, -math.pi / 4):
            at(box('Shuriken blade', (x, -.158, .99), (.09, .012, .022), M['steel'], .004, 1, rot=(0, a, 0)), hips)
        at(cyl('Shuriken hub', (x, -.163, .99), .014, .01, M['dark'], 'Y', 8), hips)
    spine = joint(name + '_Spine', (0, 0, .95), motion)
    at(tbox('Chest', (0, 0, 1.2), (.54, .3), (.42, .26), .5, gi, .11), spine)
    at(box('Inner layer', (0, -.138, 1.31), (.1, .02, .16), M['gunmetal'], .01, 1), spine)
    for s in (-1, 1):
        at(box('Crossed lapel', (s * .055, -.148 - (.004 if s > 0 else 0), 1.24), (.045, .025, .36), shade, .01, 1,
               rot=(0, s * .36, 0)), spine)
    # Lacquered scabbard across the back, handle end over the right shoulder.
    at(rod('Scabbard', (-.24, .2, .9), (.24, .21, 1.52), .036, M['lacquer'], 8), spine)
    at(cyl('Scabbard throat', (.22, .21, 1.49), .044, .06, M['gold'], 'Z', 10), spine)
    at(rod('Sageo cord', (-.2, .23, 1.0), (.2, .235, 1.44), .012, sash, 5), spine)
    at(tbox('Hood drape', (0, .13, 1.47), (.3, .12), (.44, .2), .2, shade, .04), spine)
    head = joint(name + '_Head', (0, 0, 1.48), spine)
    at(sphere('Neck', (0, 0, 1.5), (.09, .09, .08), shade, 12, 6), head)
    at(sphere('Head', (0, -.01, 1.65), (.175, .168, .19), M['skin'], 14, 8), head)
    at(sphere('Hood', (0, .012, 1.672), (.192, .19, .196), shade, 16, 10), head)
    at(sphere('Face mask', (0, -.045, 1.585), (.168, .15, .1), shade, 14, 8), head)
    at(box('Eye slit', (0, -.176, 1.668), (.2, .03, .056), M['skin'], .012, 1), head)
    for s in (-1, 1):
        at(sphere('Eye', (s * .05, -.19, 1.667), (.022, .008, .018), M['eye'], 8, 5), head)
        at(box('Fierce brow', (s * .052, -.19, 1.692), (.052, .012, .012), M['eye'], .003, 1, rot=(0, -s * .38, 0)),
           head)
    at(ring('Headband', (0, .012, 1.735), .192, .024, sash, (1.02, 1, 1)), head)
    at(box('Headband plate', (0, -.192, 1.735), (.09, .014, .045), M['steel'], .006, 1), head)
    for s in (-1, 1):
        # Long ribbon tails stream behind the running ninja.
        at(box('Headband tail', (s * .035, .3, 1.7), (.055, .24, .012), sash, .004, 1, rot=(-.35, 0, s * .15)), head)
        at(box('Headband tail', (s * .06, .5, 1.6), (.05, .22, .012), sash, .004, 1, rot=(-.6, 0, s * .25)), head)
    for side, x in (('L', -.36), ('R', .36)):
        arm = joint(name + '_Arm' + side, (x, 0, 1.39), spine)
        at(sphere('Shoulder', (x * .96, 0, 1.36), (.12, .125, .115), gi, 12, 8), arm)
        at(limb('Sleeve', (x, -.02, 1.35), (x, -.2, 1.12), .1, .086, gi), arm)
        fore = joint(name + '_Forearm' + side, (x, -.2, 1.12), arm)
        hand = (.29, -.47, 1.15) if side == 'R' else (-.02, -.52, 1.17)
        at(limb('Forearm wraps', (x, -.2, 1.12), hand, .072, .06, wrap), fore)
        mid = tuple((a * .55 + b * .45) for a, b in zip((x, -.2, 1.12), hand))
        at(limb('Steel bracer', (x * .98, -.24, 1.125), mid, .079, .07, M['gunmetal']), fore)
        at(sphere('Glove', hand, (.064, .076, .06), shade, 10, 6), fore)
        if side == 'R':
            joint(name + '_Weapon', (.28, -.50, 1.17), fore)
    for side, x in (('L', -.17), ('R', .17)):
        thigh = joint(name + '_Thigh' + side, (x, 0, .87), hips)
        at(limb('Hakama leg', (x, 0, .87), (x * 1.08, -.01, .48), .13, .14, gi), thigh)
        shin = joint(name + '_Shin' + side, (x, 0, .48), thigh)
        at(sphere('Knee fold', (x * 1.06, -.02, .49), (.13, .13, .08), gi, 10, 6), shin)
        at(limb('Shin wraps', (x, -.01, .46), (x, 0, .19), .085, .072, wrap), shin)
        for z in (.4, .32, .24):
            at(cyl('Wrap binding', (x, -.005, z), .089 - (.4 - z) * .06, .016, shade, 'Z', 12), shin)
        at(tbox('Tabi boot', (x, -.05, .1), (.17, .22), (.2, .34), .19, shade, .06, shift=(0, .03)), shin)
        at(box('Split toe', (x, -.215, .06), (.012, .05, .09), M['dark'], .003, 1), shin)
        at(box('Sole', (x, -.06, .02), (.21, .35, .04), M['rubber'], .014), shin)
    return finish_asset(name)


def katana():
    """Curved blade at the common grip origin (blade toward -Y, flat facing up like weapon_sword)."""
    steel = mat('Blade brushed steel', '#8e9ba2', .28, .8)
    edge = mat('Honed bevel', '#e4ecec', .18, .9)
    silk = mat('Crimson silk wrap', '#c21f2a', .6)
    bm = bmesh.new()
    rows = []
    n = 14
    for i in range(n + 1):
        t = i / n
        y = -.12 - t * .98
        curve = .08 * t * t  # sori: the blade sweeps back toward +X
        width = .08 - .018 * t
        if i == n:
            rows.append([bm.verts.new((curve + .02, y - .07, 0))] * 4)
            break
        spine_x, edge_x = curve + width / 2, curve - width / 2
        mid = curve + width * .12
        rows.append([bm.verts.new((mid, y, .011)), bm.verts.new((edge_x, y, 0)),
                     bm.verts.new((mid, y, -.011)), bm.verts.new((spine_x, y, 0))])
    faces = []
    for a, b in zip(rows, rows[1:]):
        for k in range(4):
            q = [a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]]
            uniq = list(dict.fromkeys(q))
            if len(uniq) >= 3:
                f = bm.faces.new(uniq)
                f.material_index = 1 if k in (0, 1) else 0
                faces.append(f)
    bm.faces.new(rows[0][::-1]).material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new('Curved katana blade')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(steel)
    mesh.materials.append(edge)
    o = bpy.data.objects.new('Curved katana blade', mesh)
    bpy.context.collection.objects.link(o)
    K.current.append(o)
    box('Habaki collar', (0, -.115, 0), (.05, .03, .03), M['gold'], .006, 1)
    cyl('Round tsuba', (0, -.093, 0), .062, .016, M['gold'], 'Y', 18, .004)
    cyl('Tsuba inset', (0, -.093, 0), .046, .018, M['lacquer'], 'Y', 18)
    cyl('Same grip', (0, .06, 0), .026, .26, M['lacquer'], 'Y', 8)
    for y in (-.03, .02, .07, .12, .17):
        box('Silk diamond', (0, y, 0), (.06, .03, .06), silk, .004, 1, rot=(0, math.pi / 4, 0))
    cyl('Kashira pommel', (0, .2, 0), .03, .03, M['gold'], 'Y', 12, .006)
    return finish_asset('weapon_katana')


# ============================================================ ammo box
def ammo_box():
    olive = mat('Ammo can olive', '#5f7d2a', .5, .25)
    lid = mat('Ammo can lid', '#4a6620', .5, .25)
    copper = mat('Copper bullet', '#c4502a', .3, .8)
    box('Ammo can', (0, 0, .22), (.7, .36, .4), olive, .04)
    box('Stencil band', (0, 0, .2), (.712, .372, .085), M['hazard'], .012, 1)
    box('Lid seal', (0, 0, .415), (.715, .375, .02), M['rubber'], .006, 1)
    box('Can lid', (0, 0, .447), (.73, .39, .06), lid, .024)
    for s in (-1, 1):
        box('Handle post', (s * .15, 0, .49), (.035, .045, .05), M['gunmetal'], .008, 1)
        for x in (-.28, -.16, -.04):
            box('Stencil mark', (x + .16, s * -.187, .32), (.07, .006, .04), M['dark'], .002, 1)
    rod('Carry handle', (-.16, 0, .52), (.16, 0, .52), .016, M['gunmetal'], 8)
    box('Lid latch', (.375, 0, .39), (.035, .13, .12), M['gunmetal'], .01, 1)

    def round_(x, y, z, axis='Y'):
        tip = (x, y - .1, z) if axis == 'Y' else (x - .1, y, z)
        cyl('Cartridge case', (x, y, z), .028, .15, M['brass'], axis, 10)
        cyl('Bullet tip', tip, .028, .06, copper, axis, 10, radius2=.009)

    # A linked belt of brass rounds across the lid, draping over the latch side.
    for i in range(8):
        x = -.28 + i * .075
        round_(x, .02, .505)
        if i:
            box('Belt link', (x - .037, .06, .5), (.018, .05, .03), M['steel'], .004, 1)
    for z in (.44, .36, .28):
        round_(.4, .02, z)
    round_(-.42, .26, .03, 'X')
    round_(-.5, -.1, .03)
    return finish_asset('ammoBox')


# =============================================================== bosses
def sky_wraith():
    """SKY WRAITH: tandem-seat attack helicopter. Nose toward -Y."""
    name = 'skyWraith'
    hull = mat('Wraith teal', '#2f6874', .4, .35)
    graphite = mat('Wraith graphite', '#1e2b32', .45, .4)
    trim = mat('Wraith orange', '#ff7a1a', .4, .1)
    sensor = mat('Wraith sensor', '#5dff9a', .2, emit=2.4)
    tbox('Forward fuselage', (0, -1.25, 1.35), (.86, 2.6), (1.18, 2.8), 1.05, hull, .22)
    tbox('Aft fuselage', (0, .85, 1.5), (1.0, 1.8), (1.26, 1.8), 1.25, hull, .24)
    sphere('Nose cone', (0, -2.72, 1.22), (.52, .62, .48), hull, 16, 10)
    box('Orange nose band', (0, -2.35, 1.3), (1.0, .14, .92), trim, .06)
    sphere('Sensor turret', (0, -3.12, 1.02), .29, graphite, 14, 8)
    for x in (-.13, .13):
        cyl('Targeting lens', (x, -3.4, 1.05), .085, .05, sensor, 'Y', 12)
    sphere('Gunner canopy', (0, -1.98, 1.84), (.38, .72, .34), M['glass'], 16, 8)
    sphere('Pilot canopy', (0, -.95, 2.02), (.4, .78, .38), M['glass'], 16, 8)
    for y in (-2.0, -.95):
        box('Canopy frame', (0, y, 2.06 + (y + 2) * .17), (.05, 1.3, .08), graphite, .02, 1)
    for s in (-1, 1):
        cyl('Engine nacelle', (s * .82, .75, 2.15), .32, 1.7, graphite, 'Y', 14, .06)
        cyl('Intake ring', (s * .82, -.1, 2.15), .34, .1, trim, 'Y', 14, .02)
        cyl('Hot exhaust', (s * .95, 1.66, 2.2), .22, .2, M['dark'], 'Y', 12)
        box('Flank chevron', (s * .64, -.5, 1.45), (.04, .9, .16), trim, .015, 1, rot=(0, 0, 0))
        box('Stub wing', (s * 1.35, -.15, 1.32), (1.55, .78, .12), hull, .05, rot=(0, s * .1, 0))
        box('Wing tip', (s * 2.12, -.15, 1.25), (.1, .8, .16), trim, .03)
        pod = joint(name + '_Pod' + ('0' if s < 0 else '1'), (s * 1.5, -.3, 1.0))
        at(cyl('Rocket pod', (s * 1.5, -.3, 1.0), .27, 1.15, graphite, 'Y', 14, .06), pod)
        at(cyl('Pod nose ring', (s * 1.5, -.9, 1.0), .28, .1, trim, 'Y', 14, .03), pod)
        for i in range(7):
            a = i * math.tau / 7
            r = 0 if i == 6 else .16
            at(cyl('Rocket tube', (s * 1.5 + math.cos(a) * r, -.96, 1.0 + math.sin(a) * r), .05, .03, M['dark'], 'Y', 8),
               pod)
        joint(name + '_Launch' + ('0' if s < 0 else '1'), (s * 1.5, -1.0, 1.0), pod)
        for dz in (.02, -.2):
            cyl('Rail missile', (s * 2.02, -.25, 1.12 + dz), .075, .85, M['steel'], 'Y', 8)
            cyl('Missile seeker', (s * 2.02, -.72, 1.12 + dz), .075, .1, M['drum_red'], 'Y', 8, radius2=.03)
        rod('Gear strut', (s * .55, -.6, .9), (s * .75, -.6, .25), .05, graphite, 8)
        cyl('Landing wheel', (s * .78, -.6, .22), .2, .14, M['rubber'], 'X', 14, .04)
    # Chin chain gun on its own mount; ballistics fire from MuzzleAux.
    aux = joint(name + '_AuxGun', (0, -2.35, .72))
    at(sphere('Chin turret', (0, -2.35, .78), (.26, .26, .2), graphite, 12, 8), aux)
    boss_assets.barrel(K, M, 'Chain gun', 0, -2.78, .7, .055, .78, aux)
    joint(name + '_MuzzleAux', (0, -3.18, .7), aux)
    limb('Tail boom', (0, 1.6, 1.62), (0, 5.05, 1.8), .38, .17, hull, 12)
    box('Boom stripe', (0, 3.4, 1.93), (.12, 1.7, .06), trim, .02, 1)
    prism('Vertical fin', [(4.55, 1.62), (5.3, 1.62), (5.55, 3.0), (5.12, 3.0)], .14, hull, bevel=.04)
    box('Fin tip', (0, 5.33, 2.98), (.16, .46, .12), trim, .03)
    box('Horizontal stabilizer', (0, 4.75, 1.72), (1.9, .42, .08), hull, .03)
    for s in (-1, 1):
        box('Stabilizer tip', (s * .96, 4.75, 1.72), (.1, .44, .12), trim, .02)
    rod('Tail gear', (0, 4.6, 1.5), (0, 4.6, .15), .035, graphite, 6)
    cyl('Tail wheel', (0, 4.6, .12), .11, .08, M['rubber'], 'X', 10, .02)
    tail = joint(name + '_TailRotor', (.22, 5.25, 2.45))
    at(cyl('Tail rotor hub', (.22, 5.25, 2.45), .09, .22, graphite, 'X', 10, .02), tail)
    for a in range(4):
        ang = a * math.pi / 2
        blade = box('Tail rotor blade', (.3, 5.25 + math.sin(ang) * .42, 2.45 + math.cos(ang) * .42),
                    (.04, .13, .84), graphite, .015, 1, rot=(-ang, 0, 0))
        at(blade, tail)
    cyl('Rotor mast', (0, -.2, 2.55), .13, .75, graphite, 'Z', 10, .02)
    rotor = joint(name + '_Rotor', (0, -.2, 2.98))
    at(cyl('Rotor hub', (0, -.2, 2.98), .3, .18, graphite, 'Z', 12, .05), rotor)
    at(sphere('Mast sight', (0, -.2, 3.18), (.24, .24, .16), graphite, 12, 6), rotor)
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        c, s = math.cos(ang), math.sin(ang)
        at(box('Rotor blade', (c * 2.2, -.2 + s * 2.2, 3.0), (4.1, .33, .06), graphite, .02, 1, rot=(0, 0, ang)), rotor)
        at(box('Blade tip', (c * 4.15, -.2 + s * 4.15, 3.005), (.34, .34, .065), trim, .015, 1, rot=(0, 0, ang)), rotor)
    return finish_asset(name)


def walker():
    """IRON SOVEREIGN: six-legged assault walker with a triple cannon head. Front toward -Y."""
    name = 'walker'
    armor = mat('Sovereign orange', '#e8742a', .42, .25)
    graph = mat('Sovereign graphite', '#39414b', .45, .45)
    core = mat('Sovereign core', '#2ff0d0', .2, emit=2.6)
    tbox('Belly hull', (0, .1, 1.82), (2.3, 2.7), (1.75, 2.15), .5, graph, .16)
    tbox('Carapace', (0, .15, 2.28), (1.9, 2.3), (2.55, 2.95), .46, armor, .18)
    for s in (-1, 1):
        box('Carapace hazard', (s * .95, -1.28, 2.28), (.5, .06, .16), M['hazard'], .02, 1, rot=(0, s * .4, 0))
        box('Side armor skirt', (s * 1.3, .15, 2.02), (.1, 2.4, .36), graph, .04)
    sphere('Dorsal dome', (0, .45, 2.5), (.95, 1.05, .32), armor, 16, 8)
    sphere('Reactor core', (0, .45, 2.72), (.42, .5, .22), core, 14, 8)
    for s in (-1, 1):
        # Vent plates hinge open when the walker overheats and exposes its core.
        vent = joint(name + '_Vent' + ('0' if s < 0 else '1'), (s * .6, .45, 2.8))
        at(box('Vent plate', (s * .31, .45, 2.84), (.56, 1.05, .08), graph, .03), vent)
        at(box('Vent stripe', (s * .31, .45, 2.885), (.44, .14, .02), M['hazard'], .006, 1), vent)
    head = joint(name + '_Turret', (0, -1.2, 2.15))
    at(box('Weapon head', (0, -1.38, 2.15), (1.4, .8, .74), armor, .16), head)
    at(box('Sensor visor', (0, -1.79, 2.38), (.9, .04, .12), core, .02, 1), head)
    at(box('Cheek plate', (0, -1.6, 1.9), (1.2, .4, .22), graph, .06), head)
    at(box('Cannon housing', (0, -1.9, 2.12), (1.5, .5, .5), graph, .1), head)
    for i, x in enumerate((-.48, 0, .48)):
        z = 2.12 if i != 1 else 2.2
        at(cyl('Triple cannon', (x, -2.65, z), .14, 1.3, M['gunmetal'], 'Y', 12), head)
        at(cyl('Cannon collar', (x, -2.4, z), .18, .12, M['hazard'], 'Y', 12), head)
        at(cyl('Muzzle brake', (x, -3.27, z), .17, .16, M['gunmetal'], 'Y', 12), head)
        at(cyl('Bore', (x, -3.355, z), .1, .012, M['dark'], 'Y', 10), head)
        joint(name + '_Muzzle' + str(i), (x, -3.36, z), head)
    box('Heat sink', (0, 1.55, 2.2), (1.1, .5, .5), graph, .08)
    for x in (-.35, 0, .35):
        box('Heat fin', (x, 1.82, 2.2), (.08, .14, .46), M['hazard'], .015, 1)
    for s in (-1, 1):
        cyl('Exhaust stack', (s * .6, 1.45, 2.65), .12, .5, graph, 'Z', 10, .02)
    n = 0
    for s in (-1, 1):
        for y, dy in ((-.85, -.95), (.15, 0), (1.1, .95)):
            hip = (s * 1.2, y, 1.95)
            knee = (s * 2.3, y + dy * .45, 2.95)
            foot = (s * 2.85, y + dy, .14)
            leg = joint(name + '_Leg' + str(n), hip)
            n += 1
            # Chunky armoured mech legs (not the spider's thin claws).
            at(sphere('Hip actuator', hip, .34, graph, 10, 6), leg)
            at(limb('Femur', hip, knee, .24, .2, graph), leg)
            at(plate('Femur armor', hip, knee, (.5, .22), armor), leg)
            at(sphere('Knee joint', knee, .3, M['hazard'], 10, 6), leg)
            at(plate('Shin armor', knee, (foot[0], foot[1], .3), (.46, .36), armor, .08), leg)
            at(sphere('Ankle joint', (foot[0], foot[1], .3), .22, graph, 10, 6), leg)
            mid = tuple((a + b) / 2 for a, b in zip(knee, foot))
            at(rod('Hydraulic ram', (knee[0] - s * .26, knee[1], knee[2] - .15), (mid[0] - s * .24, mid[1], mid[2]),
                   .055, M['steel'], 6), leg)
            at(cyl('Foot pad', (foot[0], foot[1], .12), .4, .2, graph, 'Z', 12), leg)
            for k in (-1, 1):
                at(box('Foot claw', (foot[0] + s * .18, foot[1] + k * .18, .07), (.3, .12, .12), M['hazard'], .03, 1),
                   leg)
    return finish_asset(name)


# ================================================================ build
woman('captiveWoman', True)
woman('commandoWoman', False)
ninja()
katana()
ammo_box()
sky_wraith()
walker()

for i, (name, objects) in enumerate(assets.items()):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    for o in objects:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)
        if not o.parent:
            o.location.x += i * 12
if not os.environ.get('NIGHTFALL_MODELS_OUT'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'cast.blend'))
print('EXPORTED', len(assets), 'assets into', OUT)
