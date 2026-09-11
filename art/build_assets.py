import bpy, math, os
from mathutils import Vector
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
    materials[name]=m; return m
olive=mat('Olive canvas',(.23,.30,.19)); dark=mat('Gunmetal',(.055,.08,.075)); skin=mat('Warm skin',(.63,.40,.24)); red=mat('Signal rust',(.65,.19,.105)); leaf=mat('Palm green',(.18,.34,.20)); bark=mat('Palm bark',(.29,.24,.13)); stone=mat('Weathered stone',(.31,.34,.28)); sand=mat('Sand canvas',(.52,.49,.30)); glass=mat('Smoked teal',(.055,.24,.26)); light=mat('Rescue ivory',(.8,.85,.61))
assets={}; current=[]
def finish(obj,name,material):
    obj.name=name; obj.data.materials.append(material); current.append(obj); return obj
def box(name,loc,scale,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Edge bevel','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,material)
def ico(name,loc,scale,material,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc); o=bpy.context.object; o.scale=scale; return finish(o,name,material)
def cyl(name,loc,radius,depth,material,vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc); return finish(bpy.context.object,name,material)
def beam(name,a,b,width,material):
    d=Vector(b)-Vector(a); o=box(name,(Vector(a)+Vector(b))/2,(width,width,d.length),material); o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def export(name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in current: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
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
    mesh=bpy.data.meshes.new('Hair cap');mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new('Hair cap',mesh);bpy.context.collection.objects.link(o);return finish(o,'Hair cap',dark)

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
