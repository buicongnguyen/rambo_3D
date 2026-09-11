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
olive=mat('Olive canvas',(.23,.30,.19)); dark=mat('Gunmetal',(.055,.08,.075)); skin=mat('Warm skin',(.63,.40,.24)); red=mat('Signal rust',(.65,.19,.105)); leaf=mat('Palm green',(.18,.34,.20)); bark=mat('Palm bark',(.29,.24,.13)); stone=mat('Weathered stone',(.37,.40,.32)); sand=mat('Sand canvas',(.52,.49,.30)); glass=mat('Smoked teal',(.055,.24,.26)); light=mat('Rescue ivory',(.8,.85,.61))
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
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_yup=True)
    assets[name]=list(current); current.clear()
def soldier(name,uniform,band):
    box('Torso',(0,0,1.05),(.65,.39,.63),uniform,.07)
    box('Vest',(0,-.22,1.08),(.54,.12,.43),dark,.03)
    for x in [-.18,.18]:
        box('Leg', (x,0,.42),(.24,.26,.57),uniform,.04); box('Boot',(x,-.075,.12),(.28,.44,.22),dark,.02)
    ico('Head',(0,0,1.62),(.245,.21,.28),skin,2)
    box('Headband',(0,-.01,1.73),(.49,.43,.095),band,.015)
    box('Pack',(0,.24,1.15),(.44,.23,.44),sand,.03)
    for x in [-.40,.40]: beam('Arm',(x,0,1.30),(x*.8,-.48,1.07),.19,skin)
    box('Rifle',(0.28,-.61,1.11),(.13,.80,.16),dark,.02)
    export(name)
soldier('commando',olive,red); soldier('rifleman',sand,olive); soldier('captive',light,glass)
cyl('Trunk',(0,0,2.15),.19,4.3,bark,7)
for i in range(9):
    a=i*math.tau/9
    verts=[(0,0,4.3),(math.cos(a-.32)*1.3,math.sin(a-.32)*1.3,4.55),(math.cos(a)*3.1,math.sin(a)*3.1,3.55),(math.cos(a+.32)*1.3,math.sin(a+.32)*1.3,4.55)]
    mesh=bpy.data.meshes.new('Palm frond'); mesh.from_pydata(verts,[],[(0,1,2),(0,2,3),(2,1,0),(3,2,0)]); mesh.update()
    o=bpy.data.objects.new('Frond',mesh); bpy.context.collection.objects.link(o); finish(o,'Frond',leaf)
export('palm')
ico('Boulder',(0,0,.65),(1.3,1,.9),stone,1); ico('Boulder chip',(.65,.3,.3),(.6,.5,.5),stone,1); export('rock')
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
box('Turret',(0,-.1,1.83),(1.9,2.1,.88),sand,.2)
beam('Cannon',(0,-.8,1.9),(0,-4,1.9),.23,dark)
cyl('Hatch',(0,.15,2.33),.47,.14,olive);export('tank')
ico('Fuselage',(0,0,1),(1.22,2.4,1.15),olive,2)
ico('Cockpit',(0,-1.4,1.16),(.98,1.15,.85),glass,1)
beam('Tail',(0,1.4,1.2),(0,5,1.6),.4,olive)
box('Tail fin',(0,4.65,1.95),(.12,1.3,1.7),sand)
cyl('Rotor shaft',(0,0,2.3),.13,.6,dark)
box('Rotor',(0,0,2.64),(8.3,.22,.08),dark)
box('Rotor cross',(0,0,2.65),(.22,8.3,.08),dark)
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
        collection.objects.link(o);o.location.x+=(i%4)*12;o.location.y+=(i//4)*12
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','nightfall.blend'))
print('EXPORTED',len(assets),'assets into',OUT)
