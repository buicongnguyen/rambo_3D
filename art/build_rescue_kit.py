"""Small, reusable Blender assets for readable rescue and treasure gameplay.
Prison footprint 4.2m square, front +Z after glTF conversion; Gate slides upward.
"""
import bpy, math, os, random
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import style
K = style.Kit()
def mat(name,color,metal=0,rough=.65,emission=0):
    return K.mat(name,color,rough,metal,emission)
stone=mat('Prison weathered concrete','#a79f8e');steel=mat('Prison dark steel','#3b4750',.65,.4)
edge=mat('Prison worn edges','#dcd0b5',.1);cyan=mat('Rescue cyan','#22d3f0',.2,.35,2.0)
green=mat('Banknote olive','#39a24a');paper=mat('Banknote edges','#eef3cf');band=mat('Banknote band','#ffcf3a',0,.45)
gold=mat('Stamped gold','#ffc02e',.9,.24);stamp=mat('Gold stamped recess','#9a5a0a',.65,.4)
gem=mat('Diamond crystal','#3fd8ff',.45,.12,.45);facet=mat('Diamond bright facets','#dffbff',.35,.1,.6)
created=[]
def box(name,loc,size,material,bevel=.025,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Worn bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material)
    if parent:o.parent=parent
    created.append(o);return o

def export(name):
    K.paint_height(created, flat=None if name=='prisonHouse' else .82)
    shared={}
    for o in created:
        if o.type!='MESH':continue
        uv=o.data.uv_layers.active
        key=(tuple(m.name for m in o.data.materials),tuple(tuple(round(c,5) for c in v.co) for v in o.data.vertices),tuple(round(d.uv[1],4) for d in uv.data) if uv else ())
        if key in shared:o.data=shared[key]
        else:shared[key]=o.data
    bpy.ops.object.select_all(action='DESELECT')
    for o in created:o.select_set(True)
    bpy.context.view_layer.objects.active=created[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models',name+'.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
    collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
    for o in created:
        for c in list(o.users_collection):c.objects.unlink(o)
        collection.objects.link(o)
    return list(created)

box('Slab foundation',(0,0,.12),(4.2,4.2,.24),edge)
box('Rear masonry',(0,1.92,1.5),(4.1,.3,2.8),stone)
for x in [-1.92,1.92]:
    box('Side masonry',(x,.35,1.5),(.3,3.2,2.8),stone)
    box('Door jamb',(x,-1.87,1.55),(.34,.4,3),edge)
    for y in [-1.4,-.6,.2,1]:box('Mortar seam',(x-.155*(1 if x>0 else -1),y,1.4),(.016,.026,2.3),edge,.003)
box('Partial roof',(0,.94,3.02),(4.2,2.3,.18),steel)
box('Door lintel',(0,-1.95,2.98),(4.2,.35,.32),edge)
for x in [-1.45,1.45]:
    box('Front rail',(x,-2.03,1.5),(.76,.1,.09),steel)
    for dx in [-.24,0,.24]:box('Fixed cell bar',(x+dx,-2.03,1.52),(.065,.065,2.65),steel,.01)
bpy.ops.object.empty_add();gate=bpy.context.object;gate.name='Gate';gate['joint']='Gate';created.append(gate)
for x in [-.85,.85]:box('Sliding gate frame',(x,-2.04,1.5),(.09,.1,2.65),steel,parent=gate)
for z in [.23,1.48,2.78]:box('Sliding cross rail',(0,-2.04,z),(1.8,.1,.09),steel,parent=gate)
for x in [-.6,-.3,0,.3,.6]:box('Sliding gate bar',(x,-2.04,1.5),(.055,.065,2.55),steel,.008,gate)
box('Gate lock',(0,-2.13,1.5),(.25,.11,.3),edge,parent=gate)
box('Rescue sign',(0,-2.16,3.01),(1.38,.05,.32),steel,.01)
box('Rescue sign cyan',(0,-2.2,3.01),(.88,.02,.09),cyan,.005)
box('Rescue beacon',(1.56,-1.72,3.23),(.22,.25,.25),cyan)
prison=export('prisonHouse');created=[]
for y,z in [(0,.08),(.1,.24)]:
    box('Stacked banknotes',(0,y,z),(.92,.5,.15),paper,.014)
    box('Printed top',(0,y,z+.08),(.86,.46,.018),green,.004)
    box('Paper binding',(0,y,z+.095),(.18,.53,.025),band,.004)
    box('Printed value',(.23,y,z+.1),(.12,.22,.015),paper,.002)
money=export('money');created=[]
for x,y,z in [(-.25,0,.12),(.25,0,.12),(0,.02,.36)]:
    box('Gold ingot',(x,y,z),(.46,.72,.23),gold,.06)
    box('Stamped maker line',(x,y,z+.12),(.18,.04,.008),stamp,.003)
goldobjs=export('gold');created=[]
verts=[]
for radius,z in [(.28,.68),(.57,.4)]:
    for i in range(8):
        a=i*math.pi/4;verts.append((radius*math.cos(a),radius*math.sin(a),z))
verts.append((0,0,0));faces=[tuple(range(8))]
for i in range(8):faces.extend([(i,(i+1)%8,(i+1)%8+8,i+8),(i+8,(i+1)%8+8,16)])
mesh=bpy.data.meshes.new('Cut diamond');mesh.from_pydata(verts,[],faces);mesh.materials.append(gem);mesh.materials.append(facet)
o=bpy.data.objects.new('Brilliant eight-sided diamond',mesh);bpy.context.collection.objects.link(o);created.append(o)
for i,p in enumerate(mesh.polygons):p.material_index=i%2
diamond=export('diamond')
for objects,offset in [(money,6),(goldobjs,8),(diamond,10)]:
    for o in objects:
        if not o.parent:o.location.x+=offset
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','rescue-kit.blend'))
