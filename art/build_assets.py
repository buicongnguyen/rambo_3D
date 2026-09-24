"""Nightfall main asset library: characters, vehicles, props, weapons and projectiles.

Run: .tools/blender-4.5.3-windows-x64/blender.exe --background --python-exit-code 1 --python art/build_assets.py

Art direction: stylized AAA toy-soldier look. Chunky readable silhouettes, soft
bevels, saturated glossy paint and a shared painted-light ramp (see style.py).
Runtime contracts preserved here: file names, joint names/pivots (identity rest
rotation), weapon grip origins, native footprints, mount joints and the
"Sand canvas" material that infantry roles recolour.
"""
import bpy, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import style, boss_assets

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# NIGHTFALL_MODELS_OUT lets a review build export elsewhere without touching the game.
OUT = os.environ.get('NIGHTFALL_MODELS_OUT') or os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

K = style.Kit()
box, tbox, sphere, cyl, limb, rod, prism, tire = K.box, K.tbox, K.sphere, K.cyl, K.limb, K.rod, K.prism, K.tire
joint, attach, mat = K.joint, K.attach, K.mat
P = style.PALETTE
M = {
    # Characters
    'hero': mat('Hero fatigues', P['hero_green'], .72),
    'hero_vest': mat('Hero vest', P['hero_green_dark'], .66),
    'webbing': mat('Webbing tan', P['webbing'], .7),
    'bandana': mat('Hero bandana', P['bandana'], .55),
    'sand': mat('Sand canvas', P['khaki'], .72),
    'hostile_vest': mat('Hostile vest', '#5e4a33', .66),
    'crimson': mat('Hostile crimson', P['crimson'], .45),
    'ivory': mat('Rescue ivory', P['ivory'], .8),
    'ally': mat('Ally cyan', P['cyan'], .35, emit=.6),
    'skin': mat('Warm skin', P['skin'], .62),
    'hair': mat('Matte hair', P['hair'], .85),
    'boot': mat('Boot leather', '#3d2b1f', .6),
    'eye': mat('Eye dark', '#140f0c', .25, ramp=None),
    # Hardware
    'rubber': mat('Rubber', P['rubber'], .86),
    'gunmetal': mat('Gunmetal', P['gunmetal'], .38, .55),
    'polymer': mat('Gun polymer', '#3b4248', .5),
    'furniture': mat('Gun furniture', '#c7923f', .55),
    'wood': mat('Walnut stock', '#9a5424', .5),
    'steel': mat('Bright steel', P['steel'], .3, .85),
    'brass': mat('Brass', P['brass'], .3, .9),
    'hazard': mat('Hazard yellow', P['hazard'], .45),
    'lamp': mat('Lamp glow', P['lamp'], .2, emit=2.2),
    'red_lamp': mat('Tail lamp glow', '#ff3b2f', .2, emit=2.0),
    'glass': mat('Smoked teal', P['teal_glass'], .08, .2, ramp=(.55, 1.0)),
    'cyan_glow': mat('Laser cyan', '#27e8ff', .2, emit=2.4),
    'orange_glow': mat('Hot warning orange', '#ff6a1a', .3, emit=2.2),
    # Vehicles
    'paint': mat('Vehicle paint', '#5c9e2e', .42, .12),
    'trim': mat('Vehicle trim', '#2f5a1f', .5, .1),
    'track': mat('Track rubber', '#2b2e33', .82),
    'rim': mat('Wheel rim', '#d9dee2', .3, .8),
    # Props
    'bark': mat('Palm bark', '#9a6a3a', .9),
    'bark_ring': mat('Palm bark ring', '#6f4524', .9),
    'leaf': mat('Palm green', '#3faa3a', .6, cull=False),
    'leaf_dark': mat('Palm shade green', '#23803a', .65, cull=False),
    'coconut': mat('Coconut', '#6b4424', .6),
    'pine': mat('Pine green', '#2e7a4a', .7),
    'snow': mat('Snow ivory', '#f4f8fc', .55, ramp=(.82, 1.0)),
    'stone': mat('Weathered stone', '#958c7e', .88),
    'crate_wood': mat('Crate wood', '#c07c3e', .7),
    'crate_frame': mat('Crate frame', '#7d4a22', .7),
    'canvas': mat('Tent canvas', '#8f9447', .82),
    'canvas_light': mat('Tent canvas light', '#c3b26a', .82),
    'dark': mat('Shadow interior', '#161a1c', .9, ramp=None),
    'plank': mat('Tower planks', '#b27a45', .8),
    'roof_red': mat('Corrugated roof', '#c24a2c', .55, .2),
    'sandbag': mat('Sandbags', '#c9b07a', .9),
    'stucco': mat('City stucco', '#e0ae74', .78),
    'stucco_trim': mat('City trim', '#f4ead6', .7),
    'terracotta': mat('Terracotta', '#c75c35', .7),
    'concrete': mat('City concrete', '#a6a9a5', .85),
    'drum_red': mat('Signal rust', '#d8281c', .35, .25),
    'hull_blue': mat('Boat hull', '#3c5a78', .45, .2),
    'deck_wood': mat('Deck wood', '#c48a4f', .7),
}
assets = {}


def finish_asset(name, objects=None):
    objs = K.export(os.path.join(OUT, name + '.glb'), objects)
    assets[name] = objs
    K.current = []
    return objs


def at(obj, parent):
    return attach(obj, parent)


# =============================================================== weapons
def gun(kind, o=(0, 0, 0)):
    """Weapon geometry around a grip origin; barrel toward -Y (glTF +Z). Returns parts."""
    ox, oy, oz = o
    start = len(K.current)

    def p(x, y, z):
        return (ox + x, oy + y, oz + z)

    g = M
    if kind in ('rifle', 'baked'):
        box('Receiver', p(0, -.12, .035), (.08, .40, .13), g['gunmetal'], .025)
        box('Handguard', p(0, -.43, .04), (.09, .24, .105), g['furniture'], .03)
        cyl('Barrel', p(0, -.63, .045), .02, .2, g['gunmetal'], 'Y', 10)
        cyl('Muzzle brake', p(0, -.75, .045), .032, .07, g['gunmetal'], 'Y', 10, .008)
        prism('Stock', [(.07, .085), (.31, .07), (.31, -.09), (.25, -.105), (.07, 0)], .075, g['furniture'], p(0, 0, 0), bevel=.022)
        box('Pistol grip', p(0, .005, -.07), (.055, .075, .14), g['polymer'], .02, rot=(-.32, 0, 0))
        box('Curved magazine', p(0, -.19, -.11), (.055, .10, .19), g['polymer'], .02, rot=(.28, 0, 0))
        box('Optic rail', p(0, -.16, .115), (.05, .2, .04), g['gunmetal'], .012)
        cyl('Red dot optic', p(0, -.13, .165), .035, .1, g['gunmetal'], 'Y', 10, .01)
        cyl('Optic lens', p(0, -.185, .165), .025, .012, g['red_lamp'], 'Y', 10)
    elif kind == 'shotgun':
        box('Receiver', p(0, -.08, .03), (.085, .30, .12), g['gunmetal'], .025)
        cyl('Long barrel', p(0, -.46, .07), .03, .62, g['gunmetal'], 'Y', 12, .008)
        cyl('Magazine tube', p(0, -.42, .005), .027, .5, g['gunmetal'], 'Y', 12, .008)
        box('Wood pump', p(0, -.42, .01), (.1, .2, .085), g['wood'], .035)
        prism('Wood stock', [(.06, .08), (.33, .04), (.35, -.08), (.3, -.11), (.06, -.02)], .08, g['wood'], p(0, 0, 0), bevel=.025)
        box('Pistol grip', p(0, .04, -.06), (.06, .08, .13), g['wood'], .02, rot=(-.4, 0, 0))
        for y in (-.2, -.26):
            cyl('Shell', p(.05, y, .03), .014, .05, g['hazard'], 'X', 8)
    elif kind == 'machineGun':
        box('Heavy receiver', p(0, -.1, .05), (.12, .42, .17), g['gunmetal'], .03)
        cyl('Heavy barrel', p(0, -.52, .08), .03, .5, g['gunmetal'], 'Y', 12, .008)
        for y in (-.4, -.5, -.6):
            cyl('Barrel cooling ring', p(0, y, .08), .042, .03, g['polymer'], 'Y', 12)
        cyl('Flash hider', p(0, -.8, .08), .04, .09, g['gunmetal'], 'Y', 10, .01)
        box('Carry handle', p(0, -.28, .19), (.04, .18, .04), g['polymer'], .012)
        box('Ammo box', p(.1, -.15, -.07), (.14, .2, .16), g['paint'], .03)
        for i in range(5):
            box('Belt round', p(.03, -.08 - i * .035, -.005), (.025, .018, .06), g['brass'], .006)
        prism('Stock', [(.1, .1), (.3, .08), (.3, -.06), (.1, .02)], .085, g['polymer'], p(0, 0, 0), bevel=.022)
        box('Pistol grip', p(0, .02, -.07), (.06, .08, .14), g['polymer'], .02, rot=(-.3, 0, 0))
        rod('Bipod leg', p(-.04, -.62, .06), p(-.12, -.66, -.14), .012, g['gunmetal'])
        rod('Bipod leg', p(.04, -.62, .06), p(.12, -.66, -.14), .012, g['gunmetal'])
    elif kind == 'sniper':
        box('Receiver', p(0, -.08, .035), (.075, .34, .11), g['gunmetal'], .022)
        cyl('Long barrel', p(0, -.62, .05), .02, .75, g['gunmetal'], 'Y', 10)
        cyl('Suppressor', p(0, -1.05, .05), .035, .2, g['polymer'], 'Y', 12, .01)
        prism('Chassis stock', [(-.5, .075), (.16, .075), (.36, .1), (.38, -.12), (.26, -.13), (.14, -.04), (-.5, -.02)], .085, g['paint'], p(0, 0, 0), bevel=.025)
        cyl('Long scope', p(0, -.12, .15), .042, .36, g['gunmetal'], 'Y', 12, .012)
        cyl('Scope bell', p(0, -.3, .15), .06, .08, g['gunmetal'], 'Y', 12, .012)
        cyl('Scope lens', p(0, -.345, .15), .045, .012, g['glass'], 'Y', 12)
        box('Pistol grip', p(0, .04, -.07), (.055, .075, .13), g['polymer'], .02, rot=(-.3, 0, 0))
        box('Box magazine', p(0, -.12, -.08), (.05, .1, .1), g['polymer'], .015)
    elif kind == 'flame':
        box('Igniter body', p(0, -.1, .03), (.09, .36, .12), g['gunmetal'], .03)
        cyl('Flame tube', p(0, -.5, .04), .04, .46, g['steel'], 'Y', 12, .01)
        cyl('Nozzle shroud', p(0, -.76, .04), .065, .1, g['gunmetal'], 'Y', 12, .015)
        cyl('Pilot flame', p(0, -.82, .0), .02, .03, g['orange_glow'], 'Y', 8)
        for x in (-.075, .075):
            cyl('Fuel cylinder', p(x + .06, -.05, -.07), .065, .32, g['drum_red'], 'Y', 14, .03)
        box('Hazard band', p(.06, -.05, -.07), (.28, .06, .14), g['hazard'], .01)
        box('Pistol grip', p(0, .06, -.06), (.06, .08, .13), g['polymer'], .02, rot=(-.3, 0, 0))
    elif kind == 'launcher':
        box('Frame', p(0, -.12, .02), (.09, .36, .1), g['gunmetal'], .03)
        cyl('Revolver drum', p(0, -.2, -.02), .11, .2, g['paint'], 'Y', 12, .03)
        for i in range(6):
            a = i * math.tau / 6
            cyl('Drum chamber', p(math.cos(a) * .065, -.305, -.02 + math.sin(a) * .065), .025, .012, g['gunmetal'], 'Y', 8)
        cyl('Wide barrel', p(0, -.47, .03), .05, .36, g['gunmetal'], 'Y', 12, .012)
        box('Folding stock', p(0, .2, 0), (.05, .26, .09), g['polymer'], .02)
        box('Pistol grip', p(0, .02, -.07), (.06, .08, .14), g['polymer'], .02, rot=(-.3, 0, 0))
        box('Leaf sight', p(0, -.4, .12), (.07, .03, .06), g['hazard'], .01)
    elif kind == 'explosiveArrow':
        box('Bow riser', p(0, 0, 0), (.06, .06, .4), g['polymer'], .02)
        for s in (-1, 1):
            limb('Bow limb', p(0, 0, s * .18), p(0, -.14, s * .56), .03, .018, g['paint'])
            cyl('Cam wheel', p(0, -.14, s * .56), .045, .025, g['hazard'], 'X', 12)
            rod('Bow string', p(0, -.14, s * .56), p(0, .12, 0), .006, g['gunmetal'], 6)
        rod('Nocked arrow', p(0, .14, 0), p(0, -.62, 0), .012, g['wood_light'] if 'wood_light' in g else g['furniture'], 6)
        cyl('Explosive head', p(0, -.66, 0), .035, .1, g['drum_red'], 'Y', 10, .012)
        box('Fletching', p(0, .1, .02), (.004, .08, .05), g['hazard'], .002)
    elif kind == 'missile':
        cyl('Launcher tube', p(0, -.22, .05), .1, 1.0, g['paint'], 'Y', 16, .02)
        cyl('Muzzle ring', p(0, -.73, .05), .12, .07, g['gunmetal'], 'Y', 16, .015)
        cyl('Rear flare', p(0, .3, .05), .125, .1, g['gunmetal'], 'Y', 16, .015)
        cyl('Warhead', p(0, -.83, .05), .08, .16, g['drum_red'], 'Y', 12, .03, radius2=.02)
        for y in (-.5, .08):
            cyl('Hazard band', p(0, y, .05), .103, .05, g['hazard'], 'Y', 16)
        box('Sight', p(-.12, -.28, .12), (.05, .14, .09), g['gunmetal'], .015)
        box('Pistol grip', p(0, -.05, -.1), (.06, .08, .14), g['polymer'], .02, rot=(-.3, 0, 0))
    elif kind == 'laser':
        prism('Laser body', [(.3, .02), (.3, .1), (.05, .14), (-.35, .12), (-.55, .06), (-.55, 0), (-.2, -.04), (.05, -.04)], .1, g['ivory'], p(0, 0, 0), bevel=.03)
        for y in (-.1, -.2, -.3):
            cyl('Focus coil', p(0, y, .06), .06, .035, g['cyan_glow'], 'Y', 12)
        cyl('Emitter', p(0, -.6, .04), .035, .12, g['gunmetal'], 'Y', 12, .01)
        cyl('Emitter lens', p(0, -.665, .04), .028, .01, g['cyan_glow'], 'Y', 12)
        box('Pistol grip', p(0, .04, -.08), (.06, .08, .14), g['polymer'], .02, rot=(-.3, 0, 0))
        box('Power cell', p(0, -.15, -.06), (.06, .12, .08), g['cyan_glow'], .015)
    elif kind in ('throwBomb', 'poisonBomb'):
        body = g['paint'] if kind == 'throwBomb' else mat('Toxic canister', '#86c83a', .45)
        if kind == 'throwBomb':
            sphere('Frag body', p(0, -.08, 0), (.09, .09, .11), body, 12, 8)
            for z in (-.04, .03):
                cyl('Frag groove', p(0, -.08, z), .092, .012, g['trim'], 'Z', 12)
        else:
            cyl('Gas canister', p(0, -.08, 0), .075, .2, body, 'Z', 12, .025)
            cyl('Toxic band', p(0, -.08, .02), .078, .04, mat('Toxic glow', '#c6ff3d', .3, emit=1.4), 'Z', 12)
        cyl('Fuse head', p(0, -.08, .12), .03, .05, g['gunmetal'], 'Z', 8)
        box('Safety lever', p(.02, -.08, .1), (.02, .04, .12), g['steel'], .006, rot=(0, .25, 0))
        rod('Pull ring', p(-.04, -.08, .14), p(-.07, -.08, .1), .008, g['steel'], 6)
    return K.current[start:]


# ============================================================== soldiers
def soldier(name):
    hero, enemy, ally = name == 'commando', name == 'rifleman', name == 'captive'
    uni = M['hero'] if hero else M['sand'] if enemy else M['ivory']
    vest = M['hero_vest'] if hero else M['hostile_vest']
    pouch = M['webbing'] if hero else M['hostile_vest']
    sleeve = M['skin'] if hero else uni
    motion = joint(name + '_Motion', (0, 0, 0))
    hips = joint(name + '_Hips', (0, 0, .88), motion)
    at(tbox('Pelvis', (0, 0, .86), (.46, .28), (.42, .27), .26, uni, .09), hips)
    at(box('Belt', (0, 0, .95), (.45, .29, .07), M['boot'], .03), hips)
    at(box('Belt buckle', (0, -.15, .95), (.1, .025, .06), M['brass'], .012), hips)
    spine = joint(name + '_Spine', (0, 0, .95), motion)
    at(tbox('Chest', (0, 0, 1.2), (.56, .31), (.42, .26), .5, uni, .11), spine)
    if not ally:
        at(tbox('Plate carrier', (0, -.015, 1.2), (.58, .35), (.47, .31), .38, vest, .07), spine)
        for x in (-.16, 0, .16):
            at(box('Magazine pouch', (x, -.19, 1.11), (.12, .075, .15), pouch, .03), spine)
        for x in (-.2, .2):
            at(box('Shoulder strap', (x, -.02, 1.43), (.08, .33, .05), vest, .02), spine)
        at(box('Pack', (0, .215, 1.22), (.36, .15, .36), pouch if hero else vest, .06), spine)
        at(box('Radio', (.13, .215, 1.43), (.1, .1, .12), M['gunmetal'], .02), spine)
        at(rod('Radio antenna', (.15, .23, 1.45), (.17, .25, 1.78), .01, M['gunmetal'], 6), spine)
    else:
        at(box('Torn hem', (0, -.12, 1.0), (.4, .06, .08), uni, .03, rot=(0, .08, 0)), spine)
    if hero:
        # Iconic brass bandolier across the chest.
        at(box('Bandolier', (0, -.195, 1.24), (.07, .02, .58), M['boot'], .01, rot=(0, .78, 0)), spine)
        for i in range(-2, 3):
            at(box('Bandolier round', (i * .075, -.21, 1.24 - i * .075), (.03, .02, .06), M['brass'], .006, rot=(0, .78, 0)), spine)
    head = joint(name + '_Head', (0, 0, 1.48), spine)
    at(sphere('Neck', (0, 0, 1.5), (.085, .085, .08), M['skin'], 12, 6), head)
    at(sphere('Head', (0, -.01, 1.65), (.175, .168, .19), M['skin'], 16, 10), head)
    at(sphere('Nose', (0, -.18, 1.635), (.032, .032, .037), M['skin'], 8, 5), head)
    for x in (-.058, .058):
        at(sphere('Eye', (x, -.167, 1.67), (.024, .012, .028), M['hair'], 8, 5), head)
        at(box('Brow', (x, -.17, 1.712), (.064, .02, .02), M['hair'], .006), head)
    for x in (-.165, .165):
        at(sphere('Ear', (x * 1.05, 0, 1.65), (.032, .048, .058), M['skin'], 8, 5), head)
    if enemy:
        # Khaki helmet (tinted by role) with crimson hostile identification.
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1, location=(0, .005, 1.69))
        dome = bpy.context.object
        dome.scale = (.212, .217, .2)
        K._apply(dome)
        import bmesh
        bm = bmesh.new(); bm.from_mesh(dome.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.05], context='VERTS')
        bm.to_mesh(dome.data); bm.free()
        at(K.finish(dome, 'Helmet', M['sand'], weighted=False), head)
        at(cyl('Helmet brim', (0, .005, 1.69), .228, .035, M['sand'], 'Z', 16, .012), head)
        at(cyl('Helmet band', (0, .005, 1.73), .215, .045, M['crimson'], 'Z', 16), head)
        at(box('Goggles', (0, -.18, 1.75), (.23, .05, .065), M['glass'], .02), head)
    else:
        at(sphere('Hair', (0, .018, 1.695), (.182, .175, .16), M['hair'], 14, 8), head)
        at(sphere('Hair quiff', (0, -.07, 1.815), (.105, .085, .055), M['hair'], 10, 6), head)
        band = M['bandana'] if hero else M['ally']
        bpy.ops.mesh.primitive_torus_add(major_radius=.178, minor_radius=.03, major_segments=18, minor_segments=6, location=(0, .005, 1.72))
        tor = bpy.context.object
        tor.scale = (1.02, 1.0, 1.0)
        K._apply(tor)
        at(K.finish(tor, 'Headband', band), head)
        for s in (-1, 1):
            at(box('Headband tail', (s * .04, .2, 1.66), (.05, .03, .16), band, .012, rot=(-.5, s * .25, 0)), head)
    for side, x in (('L', -.36), ('R', .36)):
        s = 1 if x > 0 else -1
        arm = joint(name + '_Arm' + side, (x, 0, 1.39), spine)
        at(sphere('Shoulder', (x * .96, 0, 1.36), (.125, .13, .12), uni, 12, 8), arm)
        if enemy:
            at(box('Crimson shoulder pad', (x, 0, 1.45), (.17, .19, .06), M['crimson'], .025), arm)
        at(limb('Upper arm', (x, -.02, 1.35), (x, -.2, 1.12), .092, .078, sleeve), arm)
        fore = joint(name + '_Forearm' + side, (x, -.2, 1.12), arm)
        hand = (.29, -.47, 1.15) if side == 'R' else (-.02, -.52, 1.17)
        at(limb('Forearm', (x, -.2, 1.12), hand, .078, .064, M['skin'] if not enemy else uni), fore)
        if enemy:
            at(limb('Rolled cuff', (x, -.2, 1.12), (x * .96, -.26, 1.125), .088, .082, uni), fore)
        at(sphere('Glove', hand, (.066, .078, .062), M['boot'] if not ally else M['skin'], 10, 6), fore)
        if side == 'R' and not ally:
            weapon = joint(name + '_Weapon', (.28, -.50, 1.17), fore)
            for part in gun('baked', (.28, -.50, 1.17)):
                at(part, weapon)
    for side, x in (('L', -.17), ('R', .17)):
        thigh = joint(name + '_Thigh' + side, (x, 0, .87), hips)
        at(limb('Thigh', (x, 0, .87), (x, -.01, .45), .13, .105, uni), thigh)
        if not ally:
            at(box('Cargo pocket', (x * 1.72, -.01, .68), (.06, .18, .18), vest, .03), thigh)
        shin = joint(name + '_Shin' + side, (x, 0, .48), thigh)
        at(sphere('Knee pad', (x, -.085, .48), (.085, .05, .078), vest if not ally else uni, 10, 6), shin)
        at(limb('Calf', (x, -.01, .52), (x, 0, .2), .105, .085, uni), shin)
        at(tbox('Boot', (x, -.05, .115), (.2, .25), (.22, .36), .21, M['boot'], .07, shift=(0, .03)), shin)
        at(box('Boot sole', (x, -.06, .025), (.23, .37, .05), M['rubber'], .018), shin)
    return finish_asset(name)


# ============================================================ vegetation
def frond(name, base, angle, length, lift, droop, width, material, segments=14):
    """V-folded, serrated palm leaf along a drooping arc."""
    ca, sa = math.cos(angle), math.sin(angle)
    side = Vector((-sa, ca, 0))
    verts, faces = [], []
    for i in range(segments + 1):
        t = i / segments
        c = Vector(base) + Vector((ca * length * t, sa * length * t, lift * math.sin(math.pi * t * .7) - droop * t * t))
        w = (width * math.sin(math.pi * min(1, t * 1.15)) ** .6 * (1 - .35 * t) + .015) * (1 if i % 2 == 0 else .62)
        fold = .32 * w
        verts += [c + side * w - Vector((0, 0, fold)), c + Vector((0, 0, .03)), c - side * w - Vector((0, 0, fold))]
    for i in range(segments):
        a = i * 3
        faces += [(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    return K.finish(o, name, material, weighted=False)


def palm():
    rng = random.Random(5)
    pts = []
    for i in range(8):
        t = i / 7
        pts.append(Vector((.55 * t * t, .12 * math.sin(t * 2.2), 4.35 * t)))
    for i in range(7):
        a, b = pts[i], pts[i + 1]
        r1, r2 = .33 - i * .02, .29 - i * .02
        # Stacked shingles: plain tapered segments, with a ring hiding each joint.
        seg = cyl('Trunk segment', (a + b) / 2, r1, (b - a).length * 1.06, M['bark'], 'Z', 8, radius2=r2)
        seg.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
        cyl('Trunk ring', a + (b - a) * .92, r2 * 1.14, .09, M['bark_ring'], 'Z', 8)
    top = pts[-1]
    for i in range(3):
        a = i * math.tau / 3 + .4
        sphere('Coconut', top + Vector((math.cos(a) * .2, math.sin(a) * .2, -.2)), .13, M['coconut'], 8, 5)
    for i in range(9):
        a = i * math.tau / 9 + rng.uniform(-.12, .12)
        frond('Frond', top + Vector((0, 0, .02)), a, rng.uniform(2.45, 2.9), .45, 1.6 + rng.uniform(-.2, .3), .52,
              M['leaf'] if i % 2 == 0 else M['leaf_dark'])
    for i in range(4):
        a = i * math.tau / 4 + .6
        frond('Crown frond', top + Vector((0, 0, .08)), a, 1.5, .75, .5, .3, M['leaf'])
    return finish_asset('palm')


def snow_pine():
    cyl('Pine trunk', (0, 0, .55), .19, 1.1, M['bark'], 'Z', 10, .03)
    tiers = [(1.05, 1.55, 1.2), (1.95, 1.22, 1.05), (2.75, .92, .95), (3.45, .6, .85)]
    for z, r, h in tiers:
        cyl('Pine tier', (0, 0, z), r, h, M['pine'], 'Z', 12, .06, radius2=r * .18, segments=1)
        cyl('Snow cap', (0, 0, z + h * .12), r * .82, h * .62, M['snow'], 'Z', 12, .1, radius2=r * .1, segments=1)
    sphere('Snow tip', (0, 0, 3.98), (.14, .14, .2), M['snow'], 10, 6)
    return finish_asset('snowPine')


def rock():
    rng = random.Random(77)
    for name, loc, sc, sub in (('Boulder', (0, 0, .62), (1.3, 1.0, .88), 2), ('Boulder chip', (.78, .35, .28), (.52, .45, .42), 1),
                               ('Pebble', (-.8, -.45, .14), (.28, .24, .2), 1)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=loc)
        o = bpy.context.object
        for v in o.data.vertices:
            v.co *= rng.uniform(.82, 1.12)
            if v.co.z < -.3:
                v.co.z = -.3 - (v.co.z + .3) * .25
        o.scale = sc
        K._apply(o, .04, 1)
        K.finish(o, name, M['stone'], smooth=False)
    return finish_asset('rock')


# ================================================================= props
def crate():
    box('Crate body', (0, 0, .65), (1.22, 1.22, 1.22), M['crate_wood'], .04)
    for x in (-.61, .61):
        for y in (-.61, .61):
            box('Corner post', (x, y, .65), (.12, .12, 1.3), M['crate_frame'], .03)
    for z in (.06, 1.24):
        for y in (-.61, .61):
            box('Rim board', (0, y, z), (1.3, .12, .12), M['crate_frame'], .03)
        for x in (-.61, .61):
            box('Rim board', (x, 0, z), (.12, 1.3, .12), M['crate_frame'], .03)
    for z in (.36, .65, .94):
        for y in (-.612, .612):
            box('Plank groove', (0, y, z), (1.1, .006, .02), M['crate_frame'], 0)
        for x in (-.612, .612):
            box('Plank groove', (x, 0, z), (.006, 1.1, .02), M['crate_frame'], 0)
    for x in (-.64, .64):
        for y in (-.64, .64):
            for z in (.06, 1.24):
                box('Corner cap', (x, y, z), (.1, .1, .1), M['gunmetal'], .025)
    box('Stencil plate', (0, -.614, .68), (.5, .01, .3), M['hazard'], .006)
    for x in (-.15, 0, .15):
        box('Stencil bar', (x, -.62, .68), (.07, .01, .2), M['gunmetal'], 0)
    box('Lid stencil', (0, 0, 1.305), (.5, .5, .01), M['hazard'], .004)
    return finish_asset('crate')


def tent():
    box('Tent floor', (0, 0, .12), (4.2, 4.0, .24), M['crate_frame'], .05)
    box('Tent wall', (0, 0, 1.0), (3.9, 3.7, 1.55), M['canvas'], .1)
    prism('Tent roof', [(-2.28, 1.66), (0, 3.02), (2.28, 1.66), (2.28, 1.56), (0, 2.88), (-2.28, 1.56)], 4.05, M['canvas_light'], axis='Y', bevel=.03)
    prism('Roof ridge', [(-.14, 2.94), (0, 3.08), (.14, 2.94)], 4.15, M['canvas'], axis='Y', bevel=.01)
    box('Dark entrance', (0, -1.855, .98), (1.25, .02, 1.5), M['dark'], 0)
    for s in (-1, 1):
        box('Rolled flap', (s * .78, -1.89, 1.0), (.26, .12, 1.5), M['canvas_light'], .06)
        for y in (-1.3, 1.3):
            rod('Guy rope', (s * 2.1, y, 1.66), (s * 2.1 + s * .0, y, .25), .02, M['webbing'], 5)
    rod('Tent pole', (0, -2.05, .1), (0, -2.05, 3.5), .05, M['crate_frame'], 8)
    prism('Pennant', [(0, 3.45), (0, 3.15), (.55, 3.3)], .02, M['bandana'], (0, -2.05, 0), axis='Y', bevel=0)
    for y in (-1.3, 0, 1.3):
        for s in (-1, 1):
            box('Wall seam', (s * 1.955, y, 1.0), (.02, .04, 1.45), M['canvas_light'], .005)
    return finish_asset('tent')


def tower():
    for x in (-1, 1):
        for y in (-1, 1):
            limb('Tower leg', (x * 1.05, y * 1.05, 0), (x * .82, y * .82, 4.0), .13, .1, M['plank'], 8)
    for x in (-1, 1):
        rod('Cross brace', (x * 1.0, -1.0, .4), (x * .85, .85, 3.6), .06, M['crate_frame'], 6)
        rod('Cross brace', (x * 1.0, 1.0, .4), (x * .85, -.85, 3.6), .06, M['crate_frame'], 6)
        rod('Cross brace', (-1.0, x * 1.0, .4), (.85, x * .85, 3.6), .06, M['crate_frame'], 6)
    box('Platform', (0, 0, 4.0), (2.8, 2.8, .26), M['plank'], .05)
    for y in (-1.1, -.55, 0, .55, 1.1):
        box('Deck board seam', (0, y, 4.135), (2.7, .025, .01), M['crate_frame'], 0)
    for side in range(4):
        a = side * math.pi / 2
        for i in range(-2, 3):
            px, py = math.cos(a) * 1.22 + math.sin(a) * i * .5, math.sin(a) * 1.22 - math.cos(a) * i * .5
            b = box('Sandbag', (px, py, 4.3), (.5 if side % 2 == 0 else .3, .3 if side % 2 == 0 else .5, .2), M['sandbag'], .08)
            if side == 0 or side == 2:
                b.scale = (1, 1, 1)
        for i in range(-2, 2):
            px, py = math.cos(a) * 1.22 + math.sin(a) * (i + .5) * .5, math.sin(a) * 1.22 - math.cos(a) * (i + .5) * .5
            box('Sandbag', (px, py, 4.5), (.5 if side % 2 == 1 else .3, .3 if side % 2 == 1 else .5, .2), M['sandbag'], .08)
    for x in (-1, 1):
        for y in (-1, 1):
            rod('Roof pole', (x * 1.15, y * 1.15, 4.1), (x * 1.15, y * 1.15, 5.7), .05, M['crate_frame'], 6)
    prism('Tower roof', [(-1.7, 5.62), (0, 6.05), (1.7, 5.62), (1.7, 5.52), (0, 5.93), (-1.7, 5.52)], 3.2, M['roof_red'], axis='Y', bevel=.02)
    for x in (-1.2, -.6, 0, .6, 1.2):
        prism('Roof rib', [(-1.7, 5.64), (0, 6.07), (1.7, 5.64)], .04, M['roof_red'], (0, x, 0), axis='Y', bevel=0)
    for x in (-.32, .32):
        rod('Ladder rail', (x, -1.25, 0), (x, -1.12, 4.1), .035, M['gunmetal'], 6)
    for i in range(12):
        z = .2 + i * .32
        rod('Ladder rung', (-.32, -1.25 + z * .03, z), (.32, -1.25 + z * .03, z), .025, M['gunmetal'], 6)
    cyl('Searchlight', (.9, -.9, 4.72), .16, .22, M['gunmetal'], 'Y', 12, .03)
    cyl('Searchlight lens', (.9, -1.02, 4.72), .13, .02, M['lamp'], 'Y', 12)
    return finish_asset('tower')


def house():
    # Native footprint 5 x 7 m, base at 0; world.ts scales x by w/5 and y-depth by d/7.
    box('Stucco walls', (0, 0, 2.0), (4.8, 6.8, 4.0), M['stucco'], .08)
    box('Plinth', (0, 0, .2), (4.95, 6.95, .4), M['terracotta'], .05)
    box('Parapet', (0, 0, 4.1), (5.0, 7.0, .3), M['stucco_trim'], .06)
    box('Roof deck', (0, 0, 4.02), (4.6, 6.6, .1), M['concrete'], .02)
    box('Roof utility', (1.1, 1.6, 4.55), (1.1, 1.3, .7), M['concrete'], .08)
    cyl('Water tank', (-1.1, 2.1, 4.7), .5, 1.0, M['hull_blue'], 'Z', 14, .08)
    for y in (-3.41, 3.41):
        s = -1 if y < 0 else 1
        for x in (-1.5, 0, 1.5):
            for z in (1.35, 2.95):
                if y < 0 and x == 0 and z == 1.35:
                    continue
                box('Window frame', (x, y, z), (1.05, .1, 1.05), M['stucco_trim'], .03)
                box('Window glass', (x, y + s * .03, z), (.82, .06, .82), M['glass'], .01)
                box('Window sill', (x, y + s * .09, z - .56), (1.2, .2, .08), M['stucco_trim'], .02)
                prism('Awning', [(0, 0), (-.38, -.3), (-.38, -.36), (0, -.06)], 1.15, M['terracotta'], (x, y + s * .02, z + .72), axis='X', bevel=.01) if y < 0 else None
    box('Door frame', (0, -3.43, 1.1), (1.25, .12, 2.2), M['stucco_trim'], .03)
    box('Door', (0, -3.46, 1.05), (1.0, .06, 2.0), M['wood'], .02)
    box('Door step', (0, -3.62, .12), (1.6, .45, .24), M['concrete'], .03)
    for x in (-2.42, 2.42):
        for y in (-2, 0, 2):
            box('Side window', (x, y, 2.1), (.1, 1.0, 1.25), M['stucco_trim'], .03)
            box('Side glass', (x * 1.01, y, 2.1), (.06, .8, 1.05), M['glass'], .01)
    return finish_asset('house')


def fuel_drum():
    cyl('Fuel drum', (0, 0, .56), .4, 1.1, M['drum_red'], 'Z', 20, .04)
    for z in (.08, .4, .72, 1.05):
        cyl('Drum rib', (0, 0, z), .415, .045, M['drum_red'], 'Z', 20, .015)
    box('Warning diamond', (0, -.395, .58), (.3, .03, .3), M['hazard'], .01, rot=(0, math.pi / 4, 0))
    box('Hazard mark', (0, -.412, .58), (.06, .01, .16), M['gunmetal'], 0)
    cyl('Filler cap', (.17, 0, 1.12), .07, .05, M['gunmetal'], 'Z', 10, .015)
    cyl('Vent cap', (-.2, .05, 1.115), .045, .04, M['gunmetal'], 'Z', 8, .01)
    return finish_asset('fuelDrum')


def barge():
    prism('Boat hull', [(-3.4, .9), (-2.4, .1), (2.9, .1), (3.2, .45), (3.2, 1.15), (-3.55, 1.25)], 3.2, M['hull_blue'], bevel=.12)
    box('Waterline stripe', (0, 0, .4), (3.24, 5.4, .14), M['drum_red'], .04)
    box('Deck', (0, .1, 1.18), (2.95, 5.9, .12), M['deck_wood'], .03)
    box('Cabin', (0, 1.3, 1.95), (2.3, 2.2, 1.45), M['stucco_trim'], .14)
    box('Cabin roof', (0, 1.3, 2.72), (2.5, 2.4, .14), M['hull_blue'], .05)
    box('Cabin window', (0, .19, 2.1), (1.9, .05, .55), M['glass'], .02)
    for x in (-.64, 0, .64):
        box('Window mullion', (x, .16, 2.1), (.05, .05, .6), M['gunmetal'], .01)
    box('Barge turret', (0, -1.9, 1.55), (1.25, 1.4, .72), M['hull_blue'], .2)
    cyl('Barge gun', (0, -3.0, 1.62), .12, 1.9, M['gunmetal'], 'Y', 12, .02)
    for x in (-1.42, 1.42):
        for y in (-2.4, -1.2, 0, 1.2, 2.4):
            rod('Safety stanchion', (x, y, 1.2), (x, y, 1.85), .035, M['steel'], 6)
        rod('Deck handrail', (x, -2.4, 1.85), (x, 2.4, 1.85), .04, M['steel'], 6)
        for y in (-1.8, -.3, 1.4, 2.5):
            bpy.ops.mesh.primitive_torus_add(major_radius=.22, minor_radius=.08, major_segments=14, minor_segments=6, location=(x * 1.1, y, .8), rotation=(0, math.pi / 2, 0))
            K.finish(bpy.context.object, 'Rubber fender', M['hazard'])
    rod('Mast', (0, 1.7, 2.8), (0, 1.7, 3.9), .06, M['gunmetal'], 8)
    box('Radar', (0, 1.7, 3.85), (1.2, .12, .1), M['stucco_trim'], .03)
    return finish_asset('barge')


# ============================================================== vehicles
def motorcycle():
    box('Fuel tank', (0, -.02, 1.08), (.46, .7, .36), M['paint'], .15)
    box('Tank stripe', (0, -.02, 1.265), (.14, .66, .02), M['stucco_trim'], .008)
    box('Saddle', (0, .44, 1.1), (.42, .74, .14), M['rubber'], .06)
    prism('Frame', [(-.6, .5), (-.3, 1.0), (.4, 1.0), (.8, .55), (.5, .38), (-.35, .38)], .14, M['gunmetal'], bevel=.03)
    for x in (-.14, .14):
        rod('Front fork', (x, -.85, .4), (x, -.4, 1.3), .045, M['steel'], 8)
        rod('Rear shock', (x, .78, .4), (x, .25, .92), .05, M['hazard'], 8)
    box('Front fender', (0, -.9, .9), (.26, .5, .06), M['paint'], .03, rot=(-.35, 0, 0))
    box('Rear fender', (0, .9, .92), (.26, .6, .06), M['paint'], .03, rot=(.35, 0, 0))
    rod('Handlebar', (-.46, -.42, 1.4), (.46, -.42, 1.4), .03, M['gunmetal'], 8)
    for x in (-.44, .44):
        cyl('Grip', (x, -.42, 1.4), .04, .12, M['rubber'], 'X', 8)
    cyl('Headlamp housing', (0, -.56, 1.2), .16, .14, M['gunmetal'], 'Y', 14, .03)
    cyl('Headlamp', (0, -.64, 1.2), .12, .02, M['lamp'], 'Y', 14)
    box('Number plate', (0, -.62, 1.02), (.3, .03, .18), M['hazard'], .02)
    box('Engine', (0, .1, .62), (.4, .46, .38), M['gunmetal'], .06)
    for z in (.5, .58, .66, .74):
        box('Cooling fin', (0, .1, z), (.46, .44, .025), M['steel'], .006)
    rod('Exhaust', (.24, .1, .48), (.26, 1.0, .62), .065, M['steel'], 10)
    cyl('Tail lamp', (0, 1.2, 1.02), .06, .03, M['red_lamp'], 'Y', 8)
    for i, (x, y, z) in enumerate(((0, -.85, .4), (0, .85, .4))):
        pivot = joint('motorcycle_Wheel' + str(i), (x, y, z))
        for part in tire('Knobby tire', (x, y, z), .4, .24, M['rubber'], M['rim'], M['hazard'], 12):
            at(part, pivot)
    return finish_asset('motorcycle')


def jeep():
    tbox('Chassis', (0, .05, .72), (1.9, 3.3), (1.8, 3.2), .38, M['trim'], .1)
    tbox('Body tub', (0, .45, 1.12), (1.86, 2.3), (1.82, 2.3), .5, M['paint'], .12)
    tbox('Engine hood', (0, -1.0, 1.13), (1.66, 1.2), (1.78, 1.25), .52, M['paint'], .14, shift=(0, .05))
    box('Grille', (0, -1.63, 1.08), (1.42, .08, .44), M['gunmetal'], .03)
    for x in (-.5, -.25, 0, .25, .5):
        box('Grille slat', (x, -1.68, 1.08), (.08, .03, .38), M['steel'], .01)
    for x in (-.66, .66):
        cyl('Headlight', (x, -1.68, 1.22), .12, .06, M['lamp'], 'Y', 12, .01)
        cyl('Headlight bezel', (x, -1.66, 1.22), .15, .05, M['gunmetal'], 'Y', 12, .015)
        box('Seat', (x * .7, .15, 1.2), (.56, .6, .16), M['boot'], .07)
        box('Seat back', (x * .7, .44, 1.5), (.56, .14, .56), M['boot'], .07)
        rod('Roll bar front', (x * 1.02, -.42, 1.3), (x * .98, -.42, 2.02), .05, M['gunmetal'], 8)
        rod('Roll bar rear', (x * 1.02, .95, 1.3), (x * .98, .95, 2.02), .05, M['gunmetal'], 8)
        rod('Roll bar roof', (x * .98, -.42, 2.02), (x * .98, .95, 2.02), .05, M['gunmetal'], 8)
        for y in (-1.03, 1.03):
            box('Flared fender', (x * 1.02, y, 1.02), (.46, 1.05, .12), M['paint'], .05)
        cyl('Tail lamp', (x * .8, 1.62, 1.1), .07, .04, M['red_lamp'], 'Y', 8)
    rod('Roll bar cross', (-.98, .95, 2.02), (.98, .95, 2.02), .05, M['gunmetal'], 8)
    box('Windscreen frame', (0, -.46, 1.62), (1.5, .06, .6), M['gunmetal'], .03)
    box('Windscreen', (0, -.455, 1.62), (1.34, .04, .48), M['glass'], .015)
    box('Steering column', (-.47, -.4, 1.4), (.06, .06, .3), M['gunmetal'], .01, rot=(.6, 0, 0))
    bpy.ops.mesh.primitive_torus_add(major_radius=.17, minor_radius=.025, major_segments=14, minor_segments=5, location=(-.47, -.5, 1.52), rotation=(-.9, 0, 0))
    K.finish(bpy.context.object, 'Steering wheel', M['rubber'])
    box('Front bumper', (0, -1.78, .72), (2.0, .18, .2), M['gunmetal'], .05)
    cyl('Winch drum', (0, -1.86, .72), .09, .6, M['hazard'], 'X', 10, .02)
    box('Rear bumper', (0, 1.72, .72), (1.9, .14, .18), M['gunmetal'], .04)
    for x in (-.4, .4):
        box('Jerry can', (x, 1.45, 1.2), (.26, .16, .38), M['drum_red'], .04)
    box('Hood stripe', (0, -1.0, 1.395), (.3, 1.1, .01), M['stucco_trim'], .004)
    mount = joint('jeep_Turret', (0, .65, 1.73))
    at(cyl('Weapon pedestal', (0, .65, 1.55), .07, .5, M['gunmetal'], 'Z', 10), mount)
    at(box('Gun shield', (0, .18, 1.92), (.5, .05, .32), M['trim'], .02), mount)
    for part in gun('shotgun', (0, .38, 1.8)):
        part.scale = (1.4, 1.4, 1.4)
        part.location = Vector((0, .38, 1.8)) + (part.location - Vector((0, .38, 1.8))) * 1.4
        at(part, mount)
    at(box('Mounted ammunition', (.18, .5, 1.72), (.22, .24, .22), M['paint'], .03), mount)
    for i, (x, y, z) in enumerate([(x, y, .48) for x in (-1, 1) for y in (-1.03, 1.03)]):
        pivot = joint('jeep_Wheel' + str(i), (x, y, z))
        for part in tire('Offroad tire', (x, y, z), .46, .36, M['rubber'], M['rim'], M['hazard'], 12):
            at(part, pivot)
    return finish_asset('jeep')


def tank(name='tank', paint=None, trim=None):
    paint = paint or M['paint']
    trim = trim or M['trim']
    prism('Hull', [(-2.3, .62), (-2.4, 1.0), (-1.55, 1.46), (1.95, 1.46), (2.3, 1.25), (2.25, .62)], 2.5, paint, bevel=.1)
    box('Belly', (0, 0, .55), (2.3, 4.2, .3), trim, .08)
    for x in (-1, 1):
        prism('Track housing', [(-2.25, .3), (-2.55, .7), (-2.3, 1.0), (2.3, 1.0), (2.5, .7), (2.25, .3), (1.9, .05), (-1.9, .05)], .66, M['track'], (x * 1.56, 0, 0), bevel=.08)
        for y in (-2.42, 2.38):
            for dz in (-.12, .12):
                box('Track tread', (x * 1.56, y, .66 + dz), (.68, .06, .07), M['rubber'], .015)
        box('Track guard', (x * 1.56, -.05, 1.1), (.78, 4.7, .1), paint, .04)
        box('Side skirt', (x * 1.9, -.05, .96), (.06, 4.4, .28), trim, .025)
        for y in (-1.2, .5):
            box('Stowage box', (x * 1.56, y, 1.3), (.62, .9, .34), M['canvas'], .07)
        box('Jerry can', (x * 1.56, 1.65, 1.32), (.4, .3, .4), M['drum_red'], .05)
        cyl('Headlight', (x * .82, -2.05, 1.3), .12, .08, M['lamp'], 'Y', 12, .015)
        cyl('Headlight bezel', (x * .82, -2.0, 1.3), .16, .08, M['gunmetal'], 'Y', 12, .02)
        cyl('Tail lamp', (x * .9, 2.26, 1.2), .07, .04, M['red_lamp'], 'Y', 8)
    for y in (1.0, 1.2, 1.4, 1.6, 1.8):
        box('Engine grille', (0, y, 1.47), (1.3, .08, .04), M['gunmetal'], .01)
    box('Hazard chevron', (0, -1.95, 1.235), (1.2, .05, .12), M['hazard'], .02, rot=(-.5, 0, 0))
    wheels = []
    for x in (-1, 1):
        for i, y in enumerate((-1.65, -.82, 0, .82, 1.65)):
            loc = (x * 1.9, y, .5)
            pivot = joint(name + '_Wheel' + str(len(wheels)), loc)
            wheels.append(pivot)
            at(cyl('Road wheel', loc, .36, .12, M['rim'], 'X', 16, .03), pivot)
            at(cyl('Wheel hub', (x * 1.96, y, .5), .14, .06, M['hazard'], 'X', 10, .015), pivot)
            for k in range(4):
                a = k * math.pi / 2
                at(box('Wheel bolt', (x * 1.97, y + math.sin(a) * .23, .5 + math.cos(a) * .23), (.03, .06, .06), M['gunmetal'], .01), pivot)
    turret = joint(name + '_Turret', (0, -.1, 1.83))
    parts = [
        tbox('Turret', (0, .0, 1.86), (1.62, 1.95), (2.0, 2.35), .8, paint, .24, shift=(0, .08)),
        box('Turret bustle', (0, 1.2, 1.9), (1.5, .6, .56), trim, .12),
        box('Gun mantlet', (0, -1.18, 1.86), (.82, .36, .52), trim, .12),
        cyl('Cannon', (0, -2.45, 1.9), .13, 2.4, M['gunmetal'], 'Y', 14, .02),
        cyl('Bore evacuator', (0, -2.55, 1.9), .18, .42, paint, 'Y', 14, .05),
        box('Muzzle brake', (0, -3.72, 1.9), (.34, .36, .3), M['gunmetal'], .06),
        cyl('Commander cupola', (.42, .35, 2.33), .32, .18, trim, 'Z', 14, .05),
        cyl('Hatch lid', (.42, .35, 2.45), .27, .06, paint, 'Z', 14, .02),
        cyl('Loader hatch', (-.45, .25, 2.28), .22, .06, trim, 'Z', 12, .02),
        box('Periscope', (0, -.55, 2.3), (.3, .18, .14), M['gunmetal'], .03),
        box('Periscope glass', (0, -.645, 2.31), (.22, .02, .07), M['glass'], .008),
        box('Turret stripe', (0, .0, 2.265), (1.6, .18, .01), M['stucco_trim'], .005),
        rod('Whip aerial', (-.6, .95, 2.2), (-.6, .98, 3.5), .018, M['gunmetal'], 6),
        prism('Pennant', [(0, 3.5), (0, 3.28), (.45, 3.38)], .015, M['bandana'], (-.6, .98, 0), axis='Y', bevel=0),
        box('Roof machine gun', (.42, -.05, 2.6), (.08, .6, .1), M['gunmetal'], .02),
        box('MG ammo', (.55, .15, 2.55), (.14, .18, .14), M['paint'], .02),
    ]
    for s in (-1, 1):
        for i in range(3):
            parts.append(cyl('Smoke launcher', (s * .95, -.7 + i * .16, 2.12), .06, .2, M['gunmetal'], 'Y', 8, .01))
            parts[-1].rotation_euler = (math.pi / 2 - .5, 0, s * .4)
    for part in parts:
        at(part, turret)
    return wheels


def gunship():
    sphere('Fuselage', (0, -.1, 1.05), (1.1, 2.35, 1.05), M['gh_armor'], 18, 12)
    sphere('Nose', (0, -2.1, .85), (.62, .8, .6), M['gh_armor'], 14, 8)
    sphere('Cockpit', (0, -1.25, 1.35), (.75, 1.25, .72), M['glass'], 16, 10)
    box('Cockpit frame', (0, -1.25, 1.35), (.06, 2.2, 1.5), M['gunmetal'], .02)
    limb('Tail boom', (0, 1.3, 1.25), (0, 4.9, 1.6), .42, .2, M['gh_armor'], 12)
    prism('Tail fin', [(4.35, 1.5), (4.95, 1.5), (5.15, 2.7), (4.8, 2.7)], .14, M['gh_armor'], bevel=.04)
    box('Tail stripe', (0, 4.95, 2.35), (.16, .45, .3), M['crimson'], .02)
    prism('Tail stabilizer', [(4.2, 1.5), (4.7, 1.5), (4.75, 1.62), (4.3, 1.62)], 2.2, M['gh_armor'], axis='X', bevel=.03)
    cyl('Tail rotor hub', (.22, 4.95, 1.98), .1, .3, M['gunmetal'], 'X', 10, .02)
    box('Tail rotor blade', (.35, 4.95, 1.98), (.05, 1.3, .14), M['gunmetal'], .02)
    box('Tail rotor blade cross', (.35, 4.95, 1.98), (.05, .14, 1.3), M['gunmetal'], .02)
    for x in (-1, 1):
        box('Engine intake', (x * .62, .55, 1.85), (.36, 1.1, .42), M['gunmetal'], .14)
        cyl('Intake mouth', (x * .62, -.02, 1.86), .15, .06, M['dark'], 'Y', 10)
        box('Stub wing', (x * 1.35, .1, .92), (1.4, .7, .12), M['gh_armor'], .05, rot=(0, x * -.08, 0))
        cyl('Rocket pod', (x * 1.95, -.1, .7), .28, 1.3, M['gunmetal'], 'Y', 14, .06)
        cyl('Pod nose', (x * 1.95, -.78, .7), .28, .12, M['crimson'], 'Y', 14, .04)
        for i in range(6):
            a = i * math.tau / 6
            cyl('Rocket tube', (x * 1.95 + math.cos(a) * .16, -.85, .7 + math.sin(a) * .16), .05, .04, M['dark'], 'Y', 8)
        rod('Skid', (x * .95, -1.7, -.08), (x * .95, 1.7, -.08), .07, M['gunmetal'], 8)
        rod('Skid leg', (x * .95, -.8, -.08), (x * .62, -.8, .5), .06, M['gunmetal'], 6)
        rod('Skid leg', (x * .95, .8, -.08), (x * .62, .8, .5), .06, M['gunmetal'], 6)
        box('Crimson flank stripe', (x * 1.02, .45, 1.2), (.05, 1.2, .18), M['crimson'], .02)
    for y in (.85, 1.0, 1.15):
        box('Exhaust vent', (0, y, 2.0), (.5, .06, .04), M['dark'], .01)
    cyl('Rotor shaft', (0, 0, 2.3), .12, .55, M['gunmetal'], 'Z', 10, .02)
    rotor = joint('gunship_Rotor', (0, 0, 2.64))
    at(cyl('Rotor hub', (0, 0, 2.64), .3, .2, M['gunmetal'], 'Z', 12, .05), rotor)
    for a in range(4):
        ang = a * math.pi / 2
        b = box('Rotor blade', (math.cos(ang) * 2.15, math.sin(ang) * 2.15, 2.66), (4.1, .34, .07), M['dark'], .025)
        b.rotation_euler.z = ang
        at(b, rotor)
        t = box('Blade tip', (math.cos(ang) * 4.1, math.sin(ang) * 4.1, 2.665), (.3, .35, .075), M['hazard'], .02)
        t.rotation_euler.z = ang
        at(t, rotor)
    boss_assets.auxiliary(K, M, 'gunship')
    return finish_asset('gunship')


def spider():
    sphere('Armored spider', (0, .1, 1.5), (1.5, 1.2, .66), M['sp_armor'], 18, 10)
    sphere('Spider abdomen', (0, 1.25, 1.62), (1.05, 1.0, .7), M['sp_armor'], 16, 10)
    for i in range(3):
        box('Abdomen hazard stripe', (0, .8 + i * .35, 2.2 - abs(i - 1) * .12), (1.2, .12, .08), M['hazard'], .03)
    box('Spider core', (0, -.8, 1.6), (.9, .55, .44), M['gunmetal'], .12)
    sphere('Core glow', (0, -1.05, 1.62), (.26, .12, .22), M['core_glow'], 12, 8)
    for x in (-.33, -.12, .12, .33):
        sphere('Spider sensor', (x, -1.08, 1.85 - abs(x) * .3), .075, M['core_glow'], 8, 6)
    for side in (-1, 1):
        for j in range(4):
            y = -.9 + j * .6
            root = joint('spider_Leg' + str(j + (0 if side < 0 else 4)), (side * .9, y, 1.45))
            a = (side * .9, y, 1.45)
            b = (side * 2.1, y + (j - 1.5) * .3, 2.05)
            c = (side * 2.9, y + (j - 1.5) * .6, .12)
            at(limb('Leg upper', a, b, .2, .15, M['sp_leg']), root)
            at(sphere('Leg knee', b, .22, M['gunmetal'], 12, 8), root)
            at(limb('Leg lower', b, c, .14, .08, M['gunmetal']), root)
            at(sphere('Claw', c, (.16, .22, .12), M['hazard'], 10, 6), root)
    boss_assets.auxiliary(K, M, 'spider')
    return finish_asset('spider')


# ================================================================= build
for n in ('commando', 'rifleman', 'captive'):
    soldier(n)
palm()
rock()
crate()
tent()
tower()
tank()
finish_asset('tank')
M['gh_armor'] = mat('Gunship charcoal', '#3f4a52', .45, .35)
M['sp_armor'] = mat('Spider carapace', '#2f343c', .35, .5)
M['sp_leg'] = mat('Spider leg armor', '#d0452a', .4, .3)
M['core_glow'] = mat('Spider core glow', '#ff2a3d', .2, emit=2.4)
gunship()
barge()
motorcycle()
jeep()
for w in ('rifle', 'shotgun', 'machineGun', 'sniper', 'flame', 'launcher', 'explosiveArrow', 'missile', 'laser', 'throwBomb', 'poisonBomb'):
    gun(w)
    finish_asset('weapon_' + w)
# Projectiles face -Y (glTF +Z) at their centre.
cyl('Rocket body', (0, 0, 0), .065, .5, M['paint'], 'Y', 12, .02)
cyl('Warhead', (0, -.33, 0), .065, .18, M['drum_red'], 'Y', 12, .02, radius2=.015)
cyl('Exhaust glow', (0, .27, 0), .05, .05, M['orange_glow'], 'Y', 10)
for a in range(4):
    f = box('Stabilizer', (math.cos(a * math.pi / 2) * .09, .2, math.sin(a * math.pi / 2) * .09), (.1 if a % 2 == 0 else .015, .12, .015 if a % 2 == 0 else .1), M['hazard'], .006)
finish_asset('projectile_rocket')
rod('Projectile shaft', (0, .38, 0), (0, -.3, 0), .014, M['furniture'], 6)
cyl('Explosive head', (0, -.36, 0), .035, .12, M['drum_red'], 'Y', 10, .012, radius2=.012)
for s in (-1, 1):
    box('Fletching', (s * .03, .32, 0), (.05, .1, .006), M['hazard'], .002)
    box('Fletching', (0, .32, s * .03), (.006, .1, .05), M['hazard'], .002)
finish_asset('projectile_arrow')
sphere('Grenade', (0, 0, 0), (.1, .1, .12), M['paint'], 12, 8)
cyl('Grenade band', (0, 0, 0), .102, .03, M['trim'], 'Z', 12)
cyl('Grenade fuse', (0, 0, .12), .03, .05, M['gunmetal'], 'Z', 8)
finish_asset('projectile_grenade')
snow_pine()
house()
fuel_drum()
spider()
# The laser tank: the player tank design in boss armour, with a capacitor emitter.
M['laser_armor'] = mat('Laser tank armor', '#474d63', .38, .45)
M['laser_trim'] = mat('Laser tank trim', '#262a36', .45, .3)
wheels = tank('laserTank', M['laser_armor'], M['laser_trim'])
turret = next(o for o in K.current if o.get('joint') == 'Turret')
for z in (2.35, 2.52, 2.69):
    at(box('Laser capacitor', (0, .75, z), (1.1, .7, .1), M['cyan_glow'], .03), turret)
at(box('Capacitor housing', (0, .75, 2.52), (1.2, .78, .5), M['laser_trim'], .08), turret)
at(cyl('Laser aperture', (0, -3.9, 1.9), .24, .12, M['cyan_glow'], 'Y', 14, .02), turret)
at(cyl('Aperture shroud', (0, -3.8, 1.9), .3, .2, M['laser_trim'], 'Y', 14, .05), turret)
boss_assets.auxiliary(K, M, 'laserTank')
finish_asset('laserTank')
boss_assets.build(K, M, finish_asset)

# Arrange the editable source as an asset gallery. GLBs above retain origin pivots.
for i, (name, objects) in enumerate(assets.items()):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    for o in objects:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collection.objects.link(o)
        if not o.parent:
            o.location.x += (i % 6) * 12
            o.location.y += (i // 6) * 12
if not os.environ.get('NIGHTFALL_MODELS_OUT'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'nightfall.blend'))
print('EXPORTED', len(assets), 'assets into', OUT)
