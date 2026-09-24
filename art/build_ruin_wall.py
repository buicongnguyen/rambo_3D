"""Build compact beveled masonry for independently destructible wall panels.
Exported footprint: 4 x .45 m; height 2.4 m. Shared materials batch at runtime.
"""
import bpy, math, os, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import style
K = style.Kit()
def material(name, color, metallic=0, emission=0, rough=.85):
    return K.mat(name, color, rough, metallic, emission)
wall=material('Ruined masonry','#c4aa86')
trim=material('Exposed brick','#c9653c')
metal=material('Ruin reinforcement','#4a5560',.45,rough=.5)
def box(name, location, size, mat, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft edge wear','BEVEL');mod.width=bevel;mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat)
    return o

# 4 x .45 x 2.4 m wall; open top, exposed bricks and edge wear read from above.
for row in range(3):
    for col in range(4):
        h = .77 if row < 2 else .64 + .035 * ((col * 3) % 4)
        box('Masonry block',(-1.5 + col,0,.025+row*.8+h/2),(.985,.44,h),wall,.025)
for side in [-1,1]:
    for i in range(2):
        box('Exposed brick patch',(-1+i*2,side*.224,.45+i*.8),(.44,.006,.17),trim,.004)
box('Foundation',(0,0,.08),(4,.45,.16),metal,.018)
for x in [-1.25,.75]:
    box('Exposed reinforcement',(x,0,2.29),(.035,.035,.2),metal,.006)
# Reuse identical brick geometry instead of exporting it once per block.
K.paint_height(list(bpy.context.scene.objects))
shared={}
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH': continue
    uv=o.data.uv_layers.active
    key=(tuple(m.name for m in o.data.materials),tuple(tuple(round(c,5) for c in v.co) for v in o.data.vertices),tuple(round(d.uv[1],4) for d in uv.data) if uv else ())
    if key in shared: o.data=shared[key]
    else: shared[key]=o.data
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','ruin-wall.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','ruinWall.glb'),export_format='GLB',export_yup=True)
