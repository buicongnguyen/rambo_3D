"""Articulated command bosses. Blender Z-up; barrels point toward -Y."""
import math

def configure(api):
    globals().update({k: api[k] for k in ['box','ico','cyl','beam','joint','attach','mat','export','current','dark','olive','red','sand','light','glass']})

def barrel(name, x, y, z, radius, length, parent):
    o=cyl(name,(x,y,z),radius,length,dark,16);o.rotation_euler.x=math.pi/2;attach(o,parent)
    for dy in [-length*.38,length*.36]:
        o=cyl('Barrel cooling collar',(x,y+dy,z),radius*1.3,.09,sand,16);o.rotation_euler.x=math.pi/2;attach(o,parent)
    o=cyl('Recessed bore',(x,y-length/2-.005,z),radius*.70,.012,mat('Bore carbon',(.012,.018,.019)),16);o.rotation_euler.x=math.pi/2;attach(o,parent)

def auxiliary(name):
    # A separate, visible chin/roof weapon, with a muzzle used by game ballistics.
    positions={'gunship':(.68,-1.65,.30),'spider':(0,-1.05,2.05),'laserTank':(.78,-.45,2.65)}
    x,y,z=positions[name]
    root=joint(name+'_AuxGun',(x,y,z))
    attach(box('Auxiliary gun cradle',(x,y,z),(.36,.45,.28),olive,.055),root)
    barrel('Light gun',x,y-.38,z,.075,.72,root)
    joint(name+'_MuzzleAux',(x,y-.76,z),root)
    attach(box('Auxiliary ammo feed',(x+.22,y+.05,z),(.18,.32,.30),sand,.03),root)

def mech(name, rockets=False):
    armor=mat('Titan steel blue' if not rockets else 'Colossus oxide',(.22,.35,.40) if not rockets else (.49,.25,.13))
    armor.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.5
    armor.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.43
    sensor=mat('Titan optic',(.14,.82,.95))
    root=joint(name+'_Motion',(0,0,0))
    hips=joint(name+'_Hips',(0,0,2.45),root)
    attach(box('Armored pelvis',(0,0,2.45),(1.8,1.10,.70),armor,.16),hips)
    spine=joint(name+'_Spine',(0,0,2.8),root)
    attach(box('Tapered chest',(0,0,3.68),(2.25,1.15,1.65),armor,.25),spine)
    attach(box('Chest breastplate',(0,-.61,3.75),(1.55,.24,.86),olive,.12),spine)
    attach(box('Central reactor',(0,-.77,3.62),(.40,.08,.32),sensor,.06),spine)
    for x in [-.76,.76]:
        for z in [3.45,3.7,3.95]:attach(box('Chest louver',(x,-.62,z),(.34,.06,.085),dark,.015),spine)
        attach(box('Rear heat exchanger',(x,.67,3.72),(.45,.36,1.15),dark,.05),spine)
        for z in [3.3,3.55,3.8,4.05]:attach(box('Cooling fin',(x,.88,z),(.48,.10,.06),sand,.012),spine)
    # Inset armor panels, fasteners and exposed hydraulic mechanisms.
    for x in [-.62,.62]:
        for z in [3.40,4.05]:
            bolt=cyl('Breastplate hex fastener',(x,-.758,z),.045,.025,light,6);bolt.rotation_euler.x=math.pi/2;attach(bolt,spine)
    for x in [-.32,-.16,0,.16,.32]:attach(box('Abdominal heat grille',(x,-.585,3.04),(.065,.055,.27),dark,.01),spine)
    head=joint(name+'_Head' ,(0,0,4.48),spine)
    attach(cyl('Neck bearing',(0,0,4.48),.34,.30,dark),head)
    attach(box('Command helmet',(0,-.02,4.94),(1.10,.85,.85),armor,.18),head)
    attach(box('Optical visor',(0,-.475,4.97),(.76,.075,.18),sensor,.045),head)
    attach(box('Jaw grille',(0,-.46,4.7),(.58,.08,.16),dark,.03),head)
    for side,x in [('L',-.59),('R',.59)]:
        thigh=joint(name+'_Thigh'+side,(x,0,2.45),hips)
        attach(beam('Hydraulic thigh',(x,0,2.35),(x,0,1.43),.57,dark),thigh)
        attach(box('Thigh armor',(x,-.13,1.98),(.71,.73,.85),armor,.12),thigh)
        shin=joint(name+'_Shin'+side,(x,0,1.35),thigh)
        attach(ico('Knee hinge',(x,-.13,1.35),(.41,.4,.35),dark),shin)
        attach(box('Knee shield',(x,-.46,1.39),(.61,.18,.44),sand,.065),shin)
        attach(beam('Knee hydraulic ram',(x-.29,-.02,1.18),(x-.29,-.02,.47),.12,light),shin)
        attach(box('Shin armor' ,(x,-.03,.82),(.67,.71,.94),armor,.12),shin)
        attach(beam('Leg piston',(x+.30,.28,1.22),(x+.30,.28,.4),.1,light),shin)
        attach(box('Shin inset',(x,-.408,.82),(.34,.07,.58),dark,.045),shin)
        attach(box('Shin identification stripe',(x,-.45,.86),(.10,.025,.36),sand,.01),shin)
        attach(box('Armored foot' ,(x,-.31,.23),(.85,1.35,.43),dark,.09),shin)
        for y in [-.7,-.4,-.1]:attach(box('Toe tread',(x,y,.41),(.74,.1,.04),sand,.012),shin)
    for n,(side,x) in enumerate([('L',-1.40),('R',1.40)]):
        arm=joint(name+'_Arm'+side,(x,0,4.13),spine)
        attach(ico('Shoulder bearing',(x,0,4.03),(.53,.53,.53),dark),arm)
        attach(box('Shoulder pauldron',(x,0,4.31),(.98,1.05,.49),armor,.13),arm)
        for zz in [4.25,4.38]:attach(box('Shoulder panel seam',(x,-.535,zz),(.63,.035,.032),dark,.008),arm)
        attach(beam('Upper arm ram' ,(x,0,3.93),(x,-.1,3.15),.45,dark),arm)
        attach(beam('Exposed arm actuator',(x+(-.28 if n==0 else .28),-.15,3.86),(x+(-.28 if n==0 else .28),-.23,3.25),.11,light),arm)
        fore=joint(name+'_Forearm' +side,(x,-.1,3.14),arm)
        attach(box('Gun gauntlet',(x,-.58,3.22),(.78,1.24,.72),armor,.10),fore)
        attach(box('Belt ammunition',(x+(-.44 if n==0 else .44),-.36,3.18),(.26,.75,.55),sand,.035),fore)
        for yy in [-.63,-.40,-.17]:attach(box('Ammunition belt link',(x+(-.585 if n==0 else .585),yy,3.2),(.06,.14,.38),dark,.012),fore)
        for j in range(1 if rockets else 2):
            xx=x+(-.19 if j==0 else .19) if not rockets else x
            barrel('Hand cannon',xx,-1.44,3.24,.11,1.12,fore)
            joint(name+'_Muzzle'+str(n if rockets else n*2+j),(xx,-2.02,3.24),fore)
        for z in [3.0,3.22,3.44]:attach(box('Gauntlet cooling slot',(x,-.9,z),(.48,.05,.06),dark,.01),fore)
    if rockets:
        for n,x in enumerate([-1.08,1.08]):
            pod=joint(name+'_Pod'+str(n),(x,.12,4.69),spine)
            attach(box('Shoulder rocket magazine',(x,.05,4.75),(.91,1.35,.82),armor,.10),pod)
            for dx in [-.22,.22]:
                for z in [4.56,4.94]:barrel('Rocket launch tube',x+dx,-.32,z,.155,.78,pod)
            joint(name+'_Launch'+str(n),(x,-.77,4.75),pod)
    else:
        attach(beam('Command antenna',(.5,.22,5.18),(.5,.22,5.86),.045,dark),head)
    export(name)

def truck():
    name='missileTruck';armor=mat('Tempest desert armor',(.53,.45,.29));rubber=mat('Truck rubber',(.035,.045,.043))
    armor.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.42
    armor.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.48
    box('Heavy ladder chassis' ,(0,0,1.04),(2.65,5.95,.56),dark,.08)
    box('Armored cabin',(0,-1.86,2.02),(2.72,2.08,1.65),armor,.16)
    box('Sloped engine hood',(0,-2.78,1.6),(2.63,1.00,.7),armor,.12)
    box('Split windshield',(0,-2.94,2.33),(2.17,.08,.63),glass,.06)
    box('Windshield divider',(0,-3.0,2.34),(.085,.04,.69),dark,.01)
    box('Steel front bumper',(0,-3.35,1.00),(2.99,.23,.34),dark,.05)
    for x in [-.70,-.46,-.23,0,.23,.46,.70]:box('Radiator grille',(x,-3.305,1.52),(.09,.06,.39),dark,.015)
    for x in [-1.08,1.08]:
        for y in [-2.42,-1.98,-1.54]:box('Hood armor fastener',(x,y,2.87),(.06,.06,.045),light,.008)
        box('Tow lug',(x,-3.50,.98),(.18,.26,.19),sand,.025)
        box('Mirror stalk',(x*1.48,-2.43,2.59),(.10,.20,.47),dark,.02)
        box('Armored mirror',(x*1.51,-2.49,2.79),(.20,.12,.32),dark,.025)
    for x in [-1,1]:
        box('Protected headlight' ,(x,-3.32,1.57),(.36,.08,.23),light,.04)
        box('Armored side door',(x*1.38,-1.78,2.05),(.10,1.14,1.36),armor,.06)
        box('Cab side glass',(x*1.44,-1.85,2.38),(.055,.84,.46),glass,.025)
        box('Door handle',(x*1.47,-1.46,1.99),(.065,.24,.06),dark,.01)
        box('Boarding step',(x*1.49,-1.65,.91),(.40,1.18,.14),dark,.03)
        for j,y in enumerate([-2.23,.67,2.20]):
            wheel=joint(name+'_Wheel'+str(j+(0 if x<0 else 3)),(x*1.40,y,.76))
            o=cyl('All terrain tire',(x*1.40,y,.76),.72,.43,rubber,24);o.rotation_euler.y=math.pi/2;attach(o,wheel)
            o=cyl('Armored wheel hub',(x*1.64,y,.76),.39,.035,armor,16);o.rotation_euler.y=math.pi/2;attach(o,wheel)
            for k in range(12):
                a=k*math.tau/12
                o=box('Tire tread',(x*1.40,y+math.sin(a)*.7,.76+math.cos(a)*.7),(.47,.18,.07),dark,.018);o.rotation_euler.x=-a;attach(o,wheel)
            box('Wheel arch',(x*1.42,y,1.53),(.61,1.6,.16),armor,.06)
    box('Launcher flatbed',(0,1.13,1.48),(2.86,3.56,.32),armor,.06)
    for n,x in enumerate([-.77,.77]):
        pod=joint(name+'_Pod'+str(n),(x,1.24,1.90))
        attach(box('Twin missile magazine',(x,1.04,2.43),(1.28,3.18,1.43),armor,.14),pod)
        for dx in [-.29,.29]:
            for z in [2.12,2.74]:barrel('Missile tube',x+dx,-.41,z,.235,.66,pod)
        for y in [.55,1.4,2.35]:attach(box('Magazine reinforcement',(x,y,2.45),(1.33,.12,1.49),dark,.03),pod)
        joint(name+'_Launch'+str(n),(x,-.82,2.43),pod)
    for x in [-.91,.91]:box('Rear warning lamp',(x,3.04,1.49),(.27,.08,.23),red,.04)
    export(name)

def build():
    mech('quadMech');mech('rocketMech',True);truck()
