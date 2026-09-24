"""Articulated command bosses in the stylized kit. Blender Z-up; barrels point toward -Y.

Joint pivots and muzzle/launcher mounts are gameplay contracts (see tests/assets.test.mjs
and src/game.ts fireMountedGuns): keep their positions when changing the look.
"""
import math


def barrel(K, M, name, x, y, z, radius, length, parent):
    o = K.cyl(name, (x, y, z), radius, length, M['gunmetal'], 'Y', 16, .02)
    K.attach(o, parent)
    for dy in (-length * .38, length * .36):
        K.attach(K.cyl('Barrel cooling collar', (x, y + dy, z), radius * 1.3, .09, M['hazard'], 'Y', 16, .02), parent)
    K.attach(K.cyl('Muzzle flash hider', (x, y - length / 2, z), radius * 1.18, .12, M['gunmetal'], 'Y', 16, .03), parent)
    K.attach(K.cyl('Recessed bore', (x, y - length / 2 - .065, z), radius * .7, .012, M['dark'], 'Y', 16), parent)


def auxiliary(K, M, name):
    """A separate, visible chin/roof weapon, with a muzzle used by game ballistics."""
    positions = {'gunship': (.68, -1.65, .30), 'spider': (0, -1.05, 2.05), 'laserTank': (.78, -.45, 2.65)}
    x, y, z = positions[name]
    root = K.joint(name + '_AuxGun', (x, y, z))
    K.attach(K.box('Auxiliary gun cradle', (x, y, z), (.36, .45, .28), M['gunmetal'], .07), root)
    barrel(K, M, 'Light gun', x, y - .38, z, .075, .72, root)
    K.joint(name + '_MuzzleAux', (x, y - .76, z), root)
    K.attach(K.box('Auxiliary ammo feed', (x + .22, y + .05, z), (.18, .32, .30), M['hazard'], .04), root)


def mech(K, M, finish, name, rockets=False):
    box, tbox, cyl, sphere, limb, joint, attach = K.box, K.tbox, K.cyl, K.sphere, K.limb, K.joint, K.attach
    armor = K.mat('Colossus oxide' if rockets else 'Titan steel blue', '#d2561f' if rockets else '#2f7fd0', .4, .35)
    accent = K.mat('Colossus plate' if rockets else 'Titan plate', '#f0ddb8' if rockets else '#e8eef2', .45, .2)
    sensor = K.mat('Colossus optic' if rockets else 'Titan optic', '#ffcf3a' if rockets else '#39f0ff', .2, emit=2.4)
    joint_color = M['gunmetal']
    root = joint(name + '_Motion', (0, 0, 0))
    hips = joint(name + '_Hips', (0, 0, 2.45), root)
    attach(tbox('Armored pelvis', (0, 0, 2.42), (1.9, 1.15), (1.5, 1.0), .7, armor, .2), hips)
    attach(box('Hip skirt', (0, -.6, 2.28), (1.2, .18, .5), accent, .08), hips)
    spine = joint(name + '_Spine', (0, 0, 2.8), root)
    attach(tbox('Tapered chest', (0, 0, 3.7), (2.45, 1.25), (1.7, 1.0), 1.7, armor, .32), spine)
    attach(tbox('Chest breastplate', (0, -.56, 3.78), (1.6, .3), (1.2, .3), .95, accent, .14), spine)
    attach(sphere('Central reactor', (0, -.74, 3.66), (.28, .1, .28), sensor, 14, 8), spine)
    attach(cyl('Reactor ring', (0, -.72, 3.66), .36, .08, joint_color, 'Y', 16, .02), spine)
    for x in (-.8, .8):
        for z in (3.45, 3.7, 3.95):
            attach(box('Chest louver', (x, -.6, z), (.34, .06, .085), joint_color, .02), spine)
        attach(box('Rear heat exchanger', (x, .67, 3.72), (.5, .4, 1.15), joint_color, .08), spine)
        for z in (3.3, 3.55, 3.8, 4.05):
            attach(box('Cooling fin', (x, .9, z), (.52, .1, .06), M['hazard'], .015), spine)
    for x in (-.3, -.15, 0, .15, .3):
        attach(box('Abdominal heat grille', (x, -.52, 3.02), (.07, .06, .28), joint_color, .012), spine)
    for s in (-1, 1):
        attach(box('Hazard chevron', (s * .55, -.66, 4.38), (.4, .05, .12), M['hazard'], .02, rot=(0, s * .5, 0)), spine)
    head = joint(name + '_Head', (0, 0, 4.48), spine)
    attach(cyl('Neck bearing', (0, 0, 4.5), .36, .3, joint_color, 'Z', 16, .05), head)
    attach(box('Command helmet', (0, -.02, 4.95), (1.12, .9, .82), armor, .26), head)
    attach(box('Helmet crest', (0, .05, 5.38), (.18, .8, .16), accent, .06), head)
    attach(box('Optical visor', (0, -.47, 4.98), (.8, .1, .2), sensor, .05), head)
    attach(box('Jaw grille', (0, -.45, 4.7), (.6, .1, .18), joint_color, .04), head)
    for side, x in (('L', -.59), ('R', .59)):
        thigh = joint(name + '_Thigh' + side, (x, 0, 2.45), hips)
        attach(limb('Hydraulic thigh', (x, 0, 2.38), (x, 0, 1.43), .3, .26, joint_color), thigh)
        attach(box('Thigh armor', (x, -.13, 1.98), (.74, .76, .88), armor, .16), thigh)
        attach(box('Thigh stripe', (x, -.52, 2.05), (.16, .04, .6), accent, .02), thigh)
        shin = joint(name + '_Shin' + side, (x, 0, 1.35), thigh)
        attach(sphere('Knee hinge', (x, -.1, 1.36), (.4, .4, .36), joint_color, 14, 8), shin)
        attach(box('Knee shield', (x, -.47, 1.4), (.62, .2, .46), accent, .09), shin)
        attach(limb('Knee hydraulic ram', (x - .3, -.02, 1.18), (x - .3, -.02, .47), .07, .06, M['steel']), shin)
        attach(tbox('Shin armor', (x, -.03, .84), (.7, .74), (.62, .66), .96, armor, .16), shin)
        attach(limb('Leg piston', (x + .3, .28, 1.22), (x + .3, .28, .4), .06, .05, M['steel']), shin)
        attach(box('Shin inset', (x, -.41, .84), (.34, .07, .58), joint_color, .05), shin)
        attach(tbox('Armored foot', (x, -.3, .22), (.72, 1.05), (.9, 1.4), .44, joint_color, .12, shift=(0, .1)), shin)
        attach(box('Toe cap', (x, -.92, .2), (.8, .22, .32), accent, .08), shin)
    for n, (side, x) in enumerate((('L', -1.40), ('R', 1.40))):
        s = -1 if n == 0 else 1
        arm = joint(name + '_Arm' + side, (x, 0, 4.13), spine)
        attach(sphere('Shoulder bearing', (x, 0, 4.03), .5, joint_color, 14, 8), arm)
        attach(box('Shoulder pauldron', (x + s * .05, 0, 4.36), (1.05, 1.12, .55), armor, .22), arm)
        attach(box('Pauldron stripe', (x + s * .05, -.57, 4.36), (.7, .05, .14), M['hazard'], .02), arm)
        attach(limb('Upper arm ram', (x, 0, 3.93), (x, -.1, 3.15), .24, .2, joint_color), arm)
        attach(limb('Exposed arm actuator', (x + s * .28, -.15, 3.86), (x + s * .28, -.23, 3.25), .06, .05, M['steel']), arm)
        fore = joint(name + '_Forearm' + side, (x, -.1, 3.14), arm)
        attach(box('Gun gauntlet', (x, -.58, 3.22), (.8, 1.26, .74), armor, .16), fore)
        attach(box('Belt ammunition', (x + s * .44, -.36, 3.18), (.26, .75, .55), M['hazard'], .05), fore)
        for yy in (-.63, -.40, -.17):
            attach(box('Ammunition belt link', (x + s * .585, yy, 3.2), (.06, .14, .38), M['brass'], .015), fore)
        for j in range(1 if rockets else 2):
            xx = x if rockets else x + (-.19 if j == 0 else .19)
            barrel(K, M, 'Hand cannon', xx, -1.44, 3.24, .11, 1.12, fore)
            joint(name + '_Muzzle' + str(n if rockets else n * 2 + j), (xx, -2.02, 3.24), fore)
        for z in (3.0, 3.22, 3.44):
            attach(box('Gauntlet cooling slot', (x, -.92, z), (.48, .05, .06), joint_color, .012), fore)
    if rockets:
        for n, x in enumerate((-1.08, 1.08)):
            pod = joint(name + '_Pod' + str(n), (x, .12, 4.69), spine)
            attach(box('Shoulder rocket magazine', (x, .05, 4.75), (.95, 1.38, .86), armor, .16), pod)
            attach(box('Magazine face', (x, -.64, 4.75), (.9, .06, .8), joint_color, .04), pod)
            for dx in (-.22, .22):
                for z in (4.56, 4.94):
                    attach(cyl('Rocket launch tube', (x + dx, -.66, z), .15, .1, M['dark'], 'Y', 12), pod)
                    attach(cyl('Rocket nose', (x + dx, -.72, z), .11, .06, M['drum_red'], 'Y', 12, .02), pod)
            joint(name + '_Launch' + str(n), (x, -.77, 4.75), pod)
    else:
        attach(K.rod('Command antenna', (.5, .22, 5.18), (.5, .22, 5.9), .03, joint_color, 6), head)
        attach(sphere('Antenna beacon', (.5, .22, 5.93), .07, sensor, 8, 6), head)
    return finish(name)


def truck(K, M, finish):
    box, cyl, joint, attach = K.box, K.cyl, K.joint, K.attach
    name = 'missileTruck'
    armor = K.mat('Tempest desert armor', '#e3a43a', .42, .25)
    stripe = K.mat('Tempest crimson stripe', '#c4162a', .45)
    box('Heavy ladder chassis', (0, 0, 1.04), (2.6, 5.95, .56), M['gunmetal'], .1)
    box('Armored cabin', (0, -1.86, 2.05), (2.72, 2.08, 1.7), armor, .26)
    box('Sloped engine hood', (0, -2.8, 1.62), (2.63, 1.0, .72), armor, .2)
    box('Cabin stripe', (0, -1.86, 2.55), (2.76, 2.12, .2), stripe, .05)
    box('Split windshield', (0, -2.93, 2.35), (2.17, .1, .63), M['glass'], .06)
    box('Windshield divider', (0, -2.99, 2.35), (.09, .05, .69), M['gunmetal'], .015)
    box('Steel front bumper', (0, -3.35, 1.0), (2.99, .26, .38), M['gunmetal'], .07)
    box('Bumper hazard', (0, -3.49, 1.0), (2.6, .02, .16), M['hazard'], .005)
    for x in (-.70, -.46, -.23, 0, .23, .46, .70):
        box('Radiator grille', (x, -3.31, 1.52), (.09, .06, .39), M['gunmetal'], .015)
    for x in (-1.08, 1.08):
        box('Tow lug', (x, -3.5, .98), (.18, .26, .19), M['hazard'], .03)
        box('Mirror stalk', (x * 1.48, -2.43, 2.59), (.1, .2, .47), M['gunmetal'], .025)
        box('Armored mirror', (x * 1.51, -2.49, 2.79), (.2, .12, .32), M['gunmetal'], .03)
    for x in (-1, 1):
        cyl('Protected headlight', (x, -3.33, 1.57), .16, .08, M['lamp'], 'Y', 12, .015)
        box('Armored side door', (x * 1.38, -1.78, 2.05), (.1, 1.14, 1.36), armor, .06)
        box('Cab side glass', (x * 1.44, -1.85, 2.38), (.055, .84, .46), M['glass'], .025)
        box('Boarding step', (x * 1.49, -1.65, .91), (.4, 1.18, .14), M['gunmetal'], .03)
        for j, y in enumerate((-2.23, .67, 2.20)):
            loc = (x * 1.40, y, .76)
            wheel = joint(name + '_Wheel' + str(j + (0 if x < 0 else 3)), loc)
            for part in K.tire('All terrain tire', loc, .72, .5, M['rubber'], M['rim'], M['hazard'], 14):
                attach(part, wheel)
            box('Wheel arch', (x * 1.42, y, 1.56), (.66, 1.66, .18), armor, .08)
    box('Launcher flatbed', (0, 1.13, 1.48), (2.86, 3.56, .32), armor, .08)
    for n, x in enumerate((-.77, .77)):
        pod = joint(name + '_Pod' + str(n), (x, 1.24, 1.90))
        attach(box('Twin missile magazine', (x, 1.04, 2.43), (1.28, 3.18, 1.43), armor, .2), pod)
        attach(box('Magazine stripe', (x, 1.04, 3.16), (1.3, 3.2, .06), stripe, .02), pod)
        attach(box('Magazine face', (x, -.55, 2.43), (1.2, .06, 1.35), M['gunmetal'], .04), pod)
        for dx in (-.29, .29):
            for z in (2.12, 2.74):
                attach(cyl('Missile tube', (x + dx, -.6, z), .235, .12, M['dark'], 'Y', 14), pod)
                attach(cyl('Missile nose', (x + dx, -.66, z), .19, .12, M['drum_red'], 'Y', 14, .05, radius2=.06), pod)
        for y in (.55, 1.4, 2.35):
            attach(box('Magazine reinforcement', (x, y, 2.45), (1.33, .12, 1.49), M['gunmetal'], .03), pod)
        joint(name + '_Launch' + str(n), (x, -.82, 2.43), pod)
    for x in (-.91, .91):
        box('Rear warning lamp', (x, 3.04, 1.49), (.27, .08, .23), M['red_lamp'], .04)
    return finish(name)


def build(K, M, finish):
    mech(K, M, finish, 'quadMech')
    mech(K, M, finish, 'rocketMech', True)
    truck(K, M, finish)
