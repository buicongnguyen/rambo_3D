import bpy, math, os, random
from mathutils import Vector, Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','models')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials={}
def mat(name,color):
    if name in materials: return materials[name]
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.84
    bsdf=m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Metallic'].default_value=.78 if name=='Gunmetal' else .18 if name=='Signal rust' else 0
    bsdf.inputs['Roughness'].default_value=.26 if name=='Smoked teal' else .42 if name=='Gunmetal' else .87
    if name!='Smoked teal':
        rng=random.Random(name); size=128; pixels=[]
        for y in range(size):
            for x in range(size):
                grain=rng.uniform(-.035,.035)
                weave=(.022 if (x%4==0 or y%4==0) else -.006) if 'canvas' in name else 0
                stain=.035*math.sin(x*.11)*math.sin(y*.16)
                pixels.extend([max(0,min(1,c+grain+weave+stain)) for c in color]+[1])
        image=bpy.data.images.new(name+' surface',width=size,height=size)
        image.pixels.foreach_set(pixels); image.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
        m.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    materials[name]=m; return m
olive=mat('Olive canvas',(.23,.30,.19)); dark=mat('Gunmetal',(.055,.08,.075)); skin=mat('Warm skin',(.63,.40,.24)); red=mat('Signal rust',(.65,.19,.105)); leaf=mat('Palm green',(.18,.34,.20)); bark=mat('Palm bark',(.29,.24,.13)); stone=mat('Weathered stone',(.31,.34,.28)); sand=mat('Sand canvas',(.52,.49,.30)); glass=mat('Smoked teal',(.055,.24,.26)); light=mat('Rescue ivory',(.8,.85,.61))
assets={}; current=[]
def finish(obj,name,material):
    obj.name=name; obj.data.materials.append(material)
    if name not in ['Canvas roof','Frond']:
        for poly in obj.data.polygons: poly.use_smooth=True
        if len(obj.data.polygons)>6:
            mod=obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    current.append(obj); return obj
def box(name,loc,scale,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Edge bevel','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,material)
def ico(name,loc,scale,material,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=max(sub,2),radius=1,location=loc); o=bpy.context.object; o.scale=scale; return finish(o,name,material)
def cyl(name,loc,radius,depth,material,vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc); return finish(bpy.context.object,name,material)
def beam(name,a,b,width,material):
    d=Vector(b)-Vector(a)
    if name in ['Thigh','Calf','Upper arm','Forearm']:
        o=ico(name,(Vector(a)+Vector(b))/2,(width*.64,width*.62,d.length*.67),material,3)
    else: o=box(name,(Vector(a)+Vector(b))/2,(width,width,d.length),material,.008)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def export(name):
    detail_asset(name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in current: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_apply=True)
    assets[name]=list(current); current.clear()
def joint(name,loc,parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    o['joint']=name.split('_',1)[1]; current.append(o)
    if parent: attach(o,parent)
    return o

def attach(obj,parent):
    bpy.context.view_layer.update(); world=obj.matrix_world.copy(); obj.parent=parent; obj.matrix_world=world
    return obj

def hair_cap():
    vertices=[];faces=[];segments=16;rings=5
    for r in range(rings+1):
        angle=(r/rings)*math.pi/2
        for j in range(segments):
            a=j*math.tau/segments;vertices.append((math.cos(a)*.24*math.cos(angle),math.sin(a)*.215*math.cos(angle),1.775+.225*math.sin(angle)))
    for r in range(rings):
        for j in range(segments):
            a=r*segments+j;b=r*segments+(j+1)%segments;c=b+segments;d=a+segments;faces.append((a,b,c,d))
    mesh=bpy.data.meshes.new('Hair cap');mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new('Hair cap',mesh);bpy.context.collection.objects.link(o);return finish(o,'Hair cap',mat('Matte hair',(.045,.035,.024)))

def soldier(name,uniform,band):
    motion=joint(name+'_Motion',(0,0,0))
    hips=joint(name+'_Hips',(0,0,.88),motion)
    attach(box('Pelvis',(0,0,.86),(.51,.32,.27),uniform,.08),hips)
    spine=joint(name+'_Spine',(0,0,.95),motion)
    attach(ico('Shaped torso',(0,0,1.19),(.35,.23,.37),uniform,2),spine)
    attach(box('Plate carrier',(0,-.19,1.20),(.54,.16,.44),olive,.06),spine)
    for x in [-.17,0,.17]: attach(box('Magazine pouch',(x,-.285,1.13),(.13,.10,.22),sand,.02),spine)
    attach(box('Belt',(0,0,.93),(.57,.37,.08),dark,.02),spine)
    attach(box('Pack',(0,.25,1.20),(.43,.25,.45),olive,.07),spine)
    for side,x in [('L',-.17),('R',.17)]:
        thigh=joint(name+'_Thigh'+side,(x,0,.87),hips)
        attach(beam('Thigh',(x,0,.83),(x,0,.50),.23,uniform),thigh)
        knee=joint(name+'_Shin'+side,(x,0,.48),thigh)
        attach(ico('Knee pad',(x,-.10,.47),(.13,.11,.14),dark,2),knee)
        attach(beam('Calf',(x,0,.45),(x,0,.16),.18,uniform),knee)
        attach(box('Boot',(x,-.075,.10),(.24,.40,.20),dark,.055),knee)
        attach(box('Boot sole',(x,-.08,.025),(.25,.41,.045),bark,.012),knee)
    head=joint(name+'_Head',(0,0,1.48),spine)
    attach(ico('Neck',(0,0,1.49),(.12,.115,.13),skin,2),head)
    attach(ico('Head',(0,-.012,1.68),(.225,.20,.265),skin,3),head)
    attach(hair_cap(),head)
    attach(box('Headband',(0,-.015,1.77),(.47,.405,.074),band,.025),head)
    attach(ico('Nose',(0,-.205,1.66),(.05,.05,.06),skin,1),head)
    for x in [-.085,.085]: attach(box('Eye',(x,-.196,1.70),(.053,.02,.025),dark,.005),head)
    for side,x in [('L',-.36),('R',.36)]:
        shoulder=joint(name+'_Arm'+side,(x,0,1.39),spine)
        attach(ico('Shoulder',(x,0,1.35),(.16,.17,.19),uniform,2),shoulder)
        attach(beam('Upper arm',(x,-.03,1.31),(x,-.20,1.12),.17,skin),shoulder)
        elbow=joint(name+'_Forearm'+side,(x,-.20,1.12),shoulder)
        attach(beam('Forearm',(x,-.20,1.12),(x*.80,-.48,1.15),.145,skin),elbow)
        attach(ico('Glove',(x*.8,-.49,1.15),(.10,.12,.09),dark,2),elbow)
        if side=='R' and name!='captive':
            weapon=joint(name+'_Weapon',(.28,-.50,1.17),elbow)
            attach(box('Receiver',(.28,-.57,1.19),(.115,.38,.14),dark,.018),weapon)
            attach(box('Rifle stock',(.28,-.30,1.17),(.10,.22,.14),olive,.018),weapon)
            attach(beam('Barrel',(.28,-.68,1.21),(.28,-1.02,1.21),.05,dark),weapon)
            attach(box('Magazine',(.28,-.55,1.07),(.075,.12,.18),dark,.015),weapon)
            attach(box('Sight',(.28,-.52,1.29),(.06,.075,.07),dark,.01),weapon)
    export(name)

# Secondary construction detail stays within the original gameplay footprint.
def detail_asset(name):
    def to_joint(obj,key):
        parent=next((o for o in current if o.get('joint')==key),None)
        if parent: attach(obj,parent)
        return obj
    if name in ['commando','rifleman','captive']:
        for x in [-.235,.235]:
            to_joint(box('Shoulder webbing',(x,-.20,1.36),(.065,.05,.29),sand,.012),'Spine')
            to_joint(box('Carrier buckle',(x,-.235,1.31),(.078,.025,.07),dark,.012),'Spine')
        for z in [1.05,1.14,1.23,1.32]:
            to_joint(box('MOLLE webbing',(0,-.277,z),(.49,.025,.024),olive,.006),'Spine')
        for x in [-.17,0,.17]:
            to_joint(box('Pouch flap',(x,-.346,1.20),(.135,.023,.065),olive,.009),'Spine')
        to_joint(box('Radio',(.23,.19,1.41),(.12,.10,.22),dark,.02),'Spine')
        to_joint(beam('Radio antenna',(.23,.19,1.5),(.23,.19,1.84),.018,dark),'Spine')
        for side,x in [('L',-.17),('R',.17)]:
            to_joint(box('Cargo pocket',(x*1.55,.01,.66),(.07,.20,.22),olive,.025),'Thigh'+side)
            for z in [.13,.17,.21]:
                to_joint(box('Boot lace',(x,-.21,z),(.15,.022,.014),sand,.003),'Shin'+side)
        for x in [-.22,.22]: to_joint(ico('Ear',(x,0,1.67),(.045,.07,.09),skin,2),'Head')
        to_joint(box('Mouth',(0,-.203,1.57),(.09,.013,.014),bark,.004),'Head')
        for x in [-.085,.085]:
            to_joint(box('Brow',(x,-.204,1.733),(.071,.018,.013),dark,.004),'Head')
        if name!='captive':
            for y in [-.68,-.73,-.78]:
                to_joint(box('Handguard rib',(.28,y,1.20),(.135,.023,.13),olive,.006),'Weapon')
            to_joint(beam('Optic tube',(.28,-.47,1.32),(.28,-.60,1.32),.072,dark),'Weapon')
            to_joint(box('Ejection port',(.342,-.55,1.20),(.01,.09,.045),bark,.004),'Weapon')
        # Adult proportions: reduce the oversized head while preserving its pivot.
        bpy.context.view_layer.update()
        head=next(o for o in current if o.get('joint')=='Head')
        for o in list(head.children):
            if o.type!='MESH': continue
            loc,rot,scale=o.matrix_world.decompose()
            loc=Vector((0,0,1.67))+(loc-Vector((0,0,1.67)))*.74
            o.matrix_world=Matrix.LocRotScale(loc,rot,scale*.74)
    elif name=='tank':
        for x in [-1.82,1.82]:
            for y in [i*.24-2.16 for i in range(19)]:
                box('Individual tread shoe',(x,y,.85),(.12,.18,.14),stone,.025)
                box('Lower tread shoe',(x,y,.12),(.12,.18,.12),dark,.02)
            for y in [-1.65,-.8,0,.8,1.65]:
                o=cyl('Wheel hub',(x,y,.49),.13,.06,dark);o.rotation_euler.y=math.pi/2
        for x in [-1.18,1.18]:
            box('Fender',(x,0,1.13),(.45,4.35,.12),olive,.04)
            for y in [-1.5,-.65,.2,1.05]: box('Side armor panel',(x,y,1.25),(.13,.72,.43),sand,.035)
            box('Headlight housing',(x,-2.13,1.24),(.32,.16,.23),dark,.04)
            box('Headlight lens',(x,-2.225,1.25),(.23,.025,.15),light,.018)
        for y in [.9,1.05,1.2,1.35,1.5,1.65]: box('Engine grille',(0,y,1.55),(1.4,.06,.03),dark,.01)
        for x in [-.73,.73]:
            for y in [-.65,-.25,.15,.55]:
                to_joint(ico('Armor bolt',(x,y,2.22),(.04,.04,.025),dark,2),'Turret')
        to_joint(box('Periscope',(0,-.37,2.36),(.28,.18,.16),dark,.025),'Turret')
        to_joint(box('Periscope glass',(0,-.47,2.38),(.21,.025,.06),glass,.008),'Turret')
        to_joint(beam('Whip aerial',(.73,.61,2.1),(.73,.7,3.6),.025,dark),'Turret')
        to_joint(box('Muzzle brake',(0,-3.93,1.9),(.33,.38,.29),dark,.055),'Turret')
    elif name=='gunship':
        for x in [-1,1]:
            box('Sliding door',(x*.97,.33,1.05),(.08,1.5,1.18),olive,.09)
            box('Door glazing',(x*1.02,.20,1.37),(.04,.84,.47),glass,.05)
            box('Door handle',(x*1.05,.64,1.0),(.04,.22,.055),dark,.012)
            beam('Cockpit frame',(x*.1,-2.35,1.25),(x*.7,-1.35,1.89),.055,dark)
            beam('Weapons outrigger',(x*.9,.1,.6),(x*2.0,.1,.6),.17,olive)
            pod=cyl('Rocket pod',(x*1.9,-.15,.62),.30,1.35,dark);pod.rotation_euler.x=math.pi/2
            for i in range(6):
                a=i*math.tau/6
                o=cyl('Rocket tube',(x*1.9+math.cos(a)*.18,-.84,.62+math.sin(a)*.18),.065,.035,bark);o.rotation_euler.x=math.pi/2
            for y in [.9,1.04,1.18,1.32]: box('Engine cooling slit',(x*.72,y,1.85),(.32,.035,.055),dark,.01)
        beam('Tail stabilizer',(-1,4.4,1.55),(1,4.4,1.55),.15,olive)
        o=cyl('Tail rotor hub',(.2,4.65,1.98),.10,.4,dark);o.rotation_euler.y=math.pi/2
        box('Tail rotor blade',(.43,4.65,1.98),(.055,1.45,.12),dark,.015)
        box('Tail rotor blade cross',(.43,4.65,1.98),(.055,.12,1.45),dark,.015)
    elif name=='crate':
        for z in [.23,.48,.73,.98]:
            for y in [-.655,.655]: box('Plank joint',(0,y,z),(1.24,.012,.018),bark,.003)
        for x in [-.47,.47]:
            for y in [-.68,.68]:
                for z in [.15,1.15]: ico('Strap rivet',(x,y,z),(.028,.016,.028),dark,2)
        box('Shipping label',(0,-.666,.78),(.40,.016,.22),light,.005)
        for x in [-.14,-.09,-.02,.025,.08,.13]: box('Label bars',(x,-.678,.78),(.015,.01,.14),dark)
        for x in [-.69,.69]: box('Carry handle',(x,0,.88),(.045,.36,.07),dark,.015)
    elif name=='tent':
        for y in [-1.9,-1,0,1,1.9]:
            beam('Canvas roof seam',(-2.16,y,1.83),(0,y,3.02),.022,olive)
            beam('Canvas roof seam',(0,y,3.02),(2.16,y,1.83),.022,olive)
        for x in [-1.92,1.92]:
            for y in [-1.3,0,1.3]:
                box('Canvas wall seam',(x,y,1.05),(.03,.025,1.65),sand,.005)
        for x in [-.74,.74]: box('Entrance folded flap',(x,-1.97,1.02),(.19,.09,1.72),sand,.03)
        beam('Entrance rolled canvas',(-.7,-1.99,1.87),(.7,-1.99,1.87),.12,olive)
    elif name=='tower':
        for x in [-1,1]:
            beam('Cross brace',(x,-1,.3),(x*.75,.75,3.7),.09,bark)
            beam('Cross brace',(x,1,.3),(x*.75,-.75,3.7),.09,bark)
        for x in [-.38,.38]: beam('Ladder rail',(x,-1.18,0),(x,-1.18,4),.07,dark)
        for z in [i*.32+.15 for i in range(13)]: beam('Ladder rung',(-.38,-1.18,z),(.38,-1.18,z),.055,dark)
        for y in [-1,-.6,-.2,.2,.6,1]: box('Deck board seam',(0,y,4.155),(2.6,.02,.015),bark)
    elif name=='barge':
        for x in [-1.42,1.42]:
            for y in [-2.6,-1.4,0,1.4,2.6]: beam('Safety stanchion',(x,y,1.2),(x,y,1.9),.045,dark)
            beam('Deck handrail',(x,-2.6,1.9),(x,2.6,1.9),.045,dark)
            for y in [-2,-.5,1.3,2.5]:
                bpy.ops.mesh.primitive_torus_add(major_radius=.25,minor_radius=.085,major_segments=16,minor_segments=8,location=(x*1.14,y,.85),rotation=(0,math.pi/2,0))
                finish(bpy.context.object,'Rubber fender',dark)
        for x in [-.65,0,.65]: box('Window mullion',(x,.025,2.2),(.045,.05,.64),dark,.005)
        beam('Mast',(0,1.7,2.9),(0,1.7,4),.08,dark)
        beam('Radar',(-.65,1.7,3.8),(.65,1.7,3.8),.10,sand)
    elif name=='palm':
        for z in [i*.16+.15 for i in range(25)]:
            cyl('Trunk growth ring',(0,0,z),.20,.045,bark,12)
        # Individually shaped leaflets replace broad diamond silhouettes.
        for o in list(current):
            if o.name.startswith('Frond'): current.remove(o);bpy.data.objects.remove(o,do_unlink=True)
        for i in range(9):
            a=i*math.tau/9
            for j in range(1,13):
                t=j/13;rad=t*2.9;z=4.3+.55*math.sin(t*math.pi)-.7*t*t
                center=Vector((math.cos(a)*rad,math.sin(a)*rad,z))
                for side in [-1,1]:
                    width=.40*math.sin(t*math.pi)+.09
                    tip=center+Vector((math.cos(a+side*1.2)*width,math.sin(a+side*1.2)*width,-.16))
                    forward=Vector((math.cos(a)*.17,math.sin(a)*.17,.02))
                    mesh=bpy.data.meshes.new('Palm leaflet');mesh.from_pydata([center-forward,tip,center+forward],[],[(0,1,2),(2,1,0)]);mesh.update()
                    o=bpy.data.objects.new('Leaflet',mesh);bpy.context.collection.objects.link(o);finish(o,'Leaflet',leaf)
    elif name=='rock':
        rng=random.Random(77)
        for o in current:
            for v in o.data.vertices: v.co*=rng.uniform(.86,1.13)

soldier('commando',olive,red); soldier('rifleman',sand,olive); soldier('captive',light,glass)
cyl('Trunk',(0,0,2.15),.19,4.3,bark,7)
for i in range(9):
    a=i*math.tau/9
    verts=[(0,0,4.3),(math.cos(a-.32)*1.3,math.sin(a-.32)*1.3,4.55),(math.cos(a)*3.1,math.sin(a)*3.1,3.55),(math.cos(a+.32)*1.3,math.sin(a+.32)*1.3,4.55)]
    mesh=bpy.data.meshes.new('Palm frond'); mesh.from_pydata(verts,[],[(0,1,2),(0,2,3),(2,1,0),(3,2,0)]); mesh.update()
    o=bpy.data.objects.new('Frond',mesh); bpy.context.collection.objects.link(o); finish(o,'Frond',leaf)
export('palm')
ico('Boulder',(0,0,.65),(1.3,1,.9),stone,2); ico('Boulder chip',(.65,.3,.3),(.6,.5,.5),stone,1); export('rock')
box('Crate',(0,0,.65),(1.3,1.3,1.3),sand,.05)
for x in [-.46,.46]: box('Strap',(x,0,.65),(.10,1.34,1.34),olive)
box('Top seam',(0,0,1.32),(1.3,.055,.025),dark); export('crate')
box('Tent base',(0,0,.18),(4.2,4,.36),bark)
box('Tent wall',(0,0,1.10),(4,3.8,1.8),olive)
verts=[(-2.2,-2,1.8),(2.2,-2,1.8),(0,-2,3),(-2.2,2,1.8),(2.2,2,1.8),(0,2,3)]
mesh=bpy.data.meshes.new('Canvas roof');mesh.from_pydata(verts,[],[(0,2,1),(3,4,5),(0,3,5,2),(2,5,4,1)]);mesh.update();o=bpy.data.objects.new('Tent roof',mesh);bpy.context.collection.objects.link(o);finish(o,'Tent roof',sand)
box('Dark entrance',(0,-1.92,.98),(1.30,.05,1.7),dark);export('tent')
for x in [-1,1]:
    for y in [-1,1]: beam('Tower support',(x,y,0),(x*.7,y*.7,4),.18,olive)
box('Platform',(0,0,4),(2.7,2.7,.3),sand)
for x in [-1.2,1.2]: box('Railing',(x,0,4.5),(.13,2.5,.85),olive)
box('Tower roof',(0,0,5.8),(3,3,.22),olive)
for x in [-1,1]:
    for y in [-1,1]: box('Roof pole',(x,y,4.9),(.09,.09,1.6),dark)
export('tower')
box('Hull',(0,0,.92),(2.9,4.4,1.2),olive,.3)
for x in [-1.5,1.5]:
    box('Track',(x,0,.48),(.6,4.65,.84),dark,.18)
    for y in [-1.65,-.8,0,.8,1.65]: ico('Road wheel',(x*1.08,y,.49),(.14,.36,.36),stone,1)
turret_start=len(current)
box('Turret',(0,-.1,1.83),(1.9,2.1,.88),sand,.2)
beam('Cannon',(0,-.8,1.9),(0,-4,1.9),.23,dark)
cyl('Hatch',(0,.15,2.33),.47,.14,olive)
turret_parts=list(current[turret_start:]); turret=joint('tank_Turret',(0,-.1,1.83))
for part in turret_parts: attach(part,turret)
export('tank')
ico('Fuselage',(0,0,1),(1.22,2.4,1.15),olive,2)
ico('Cockpit',(0,-1.4,1.16),(.98,1.15,.85),glass,1)
beam('Tail',(0,1.4,1.2),(0,5,1.6),.4,olive)
box('Tail fin',(0,4.65,1.95),(.12,1.3,1.7),sand)
cyl('Rotor shaft',(0,0,2.3),.13,.6,dark)
rotor_start=len(current)
box('Rotor',(0,0,2.64),(8.3,.22,.08),dark)
box('Rotor cross',(0,0,2.65),(.22,8.3,.08),dark)
rotor_parts=list(current[rotor_start:]);rotor=joint('gunship_Rotor',(0,0,2.64))
for part in rotor_parts: attach(part,rotor)
for x in [-1.0,1.0]:
    beam('Skid',(x,-1.6,-.1),(x,1.7,-.1),.13,dark)
    beam('Skid leg',(x,0,-.1),(x*.7,0,.6),.12,dark)
export('gunship')
box('Barge hull',(0,0,.55),(3.3,6.6,1.1),dark,.4)
box('Deck',(0,0,1.1),(3.1,6.2,.25),sand)
box('Cabin',(0,1.3,2),(2.4,2.4,1.8),olive,.12)
box('Cabin window',(0,.07,2.2),(1.9,.05,.6),glass)
box('Barge turret',(0,-1.9,1.6),(1.3,1.5,.8),olive,.1)
beam('Barge gun',(0,-2,1.8),(0,-4,1.8),.17,dark)
export('barge')
# Arrange the editable source as an asset gallery. GLBs above retain origin pivots.
for i,(name,objects) in enumerate(assets.items()):
    collection=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(collection)
    for o in objects:
        for c in list(o.users_collection): c.objects.unlink(o)
        collection.objects.link(o)
        if not o.parent: o.location.x+=(i%4)*12; o.location.y+=(i//4)*12
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','nightfall.blend'))
print('EXPORTED',len(assets),'assets into',OUT)
