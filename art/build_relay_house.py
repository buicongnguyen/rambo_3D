"""Build the relay barracks: a real open doorway, dark interior, and readable entry trim.
Blender -Y faces forward; exported glTF faces Three.js +Z. Footprint: 5 x 6 m.
"""
import bpy, math, os, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import style
K = style.Kit()
def material(name, color, metallic=0, emission=0, rough=.8):
    return K.mat(name, color, rough, metallic, emission, ramp=None if name.endswith('dark interior') else (.70, 1.0))
wall=material('Barracks weathered plaster','#c99a5c')
trim=material('Barracks pale entry trim','#f3e6c4')
metal=material('Barracks roof and steel','#4a5663',.45,rough=.45)
black=material('Barracks dark interior','#15181b')
glass=material('Barracks inset teal glass','#2fb5c8',.25,rough=.1)
amber=material('Barracks amber entrance beacon','#ff9a1f',0,1.8)
crimson=material('Barracks hostile crimson','#c4162a',rough=.5)
def box(name, location, size, mat, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft edge wear','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat)
    return o
# The facade is three pieces around a 1.9 x 2.55 m opening, never a sealed cube.
box('Left front pier',(-1.73,-2.84,1.75),(1.54,.32,3.5),wall)
box('Right front pier',(1.73,-2.84,1.75),(1.54,.32,3.5),wall)
box('Door lintel',(0,-2.84,3.04),(1.94,.32,.92),wall)
box('Left wall',(-2.34,0,1.75),(.32,5.7,3.5),wall)
box('Right wall',(2.34,0,1.75),(.32,5.7,3.5),wall)
box('Rear wall',(0,2.84,1.75),(5,.32,3.5),wall)
box('Interior floor',(0,0,.025),(4.68,5.68,.05),black,0)
box('Interior shadow wall',(0,-.8,1.5),(4.6,.1,3),black,0)
box('Roof slab',(0,0,3.60),(5,6,.2),metal)
for x in [-2.4,2.4]:
    box('Raised roof edge',(x,0,3.78),(.18,6,.18),crimson)
for y in [-2.9,2.9]:
    box('Raised roof edge',(0,y,3.78),(5,.18,.18),crimson)
for x in [-1.04,1.04]:
    box('Recessed door jamb',(x,-2.94,1.28),(.14,.12,2.56),trim,.018)
box('Door header',(0,-2.94,2.65),(2.2,.12,.16),trim)
box('Entry canopy',(0,-2.73,2.93),(2.6,.54,.12),metal)
box('Entry threshold',(0,-2.91,.045),(1.9,.18,.09),trim,.015)
# Door is visibly parked inside, leaving the spawn corridor open.
box('Open steel door',(-1.13,-2.05,1.22),(.09,1.7,2.4),metal)
for x in [-1.74,1.74]:
    box('Front window frame',(x,-3.005,2),(1,.05,1.2),trim,.015)
    box('Front window glass',(x,-3.038,2),(.78,.02,.95),glass,.01)
    box('Front window mullion',(x,-3.052,2),(.035,.025,.96),metal,.005)
for x in [-2.51,2.51]:
    for y in [-.6,1.4]:
        box('Side window trim',(x,y,1.9),(.04,1.2,1.3),trim,.012)
        box('Side window glass',(x*1.006,y,1.9),(.035,.98,1.08),glass,.01)
box('Roof exhaust housing',(.9,.9,3.85),(1.15,1.3,.30),metal)
for y in [.43,.64,.85,1.06,1.27]:
    box('Exhaust louver',(.9,y,4.02),(.94,.06,.055),trim,.009)
box('Beacon bracket',(0,-3.01,2.95),(.65,.16,.21),black)
box('Amber response beacon',(0,-3.11,2.96),(.48,.06,.12),amber,.022)
for x in [-2.15,2.15]:
    box('Corner reinforcing strip',(x,-3.01,1.25),(.07,.07,2.45),metal,.01)
# Coordinate convention and opening dimensions are exported for validation.
root=bpy.data.objects.new('RelayHouse',None);bpy.context.collection.objects.link(root)
root['doorWidth']=1.9;root['doorHeight']=2.55;root['forward']='+Z after glTF export'
for o in list(bpy.context.scene.objects):
    if o != root:o.parent=root
K.paint_height(list(bpy.context.scene.objects))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','relayHouse.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','relay-house.blend'))
