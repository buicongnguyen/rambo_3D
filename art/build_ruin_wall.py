"""Build compact beveled masonry for independently destructible wall panels.
Exported footprint: 4 x .45 m; height 2.4 m. Shared materials batch at runtime.
"""
import bpy, math, os, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def material(name, color, metallic=0, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.84
    p.inputs['Metallic'].default_value=metallic
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    else:
        rng=random.Random(name); image=bpy.data.images.new(name+' grain',width=16,height=16)
        pixels=[]
        for y in range(16):
            for x in range(16):
                grain=rng.uniform(-.025,.025)+.018*math.sin(x*.32)*math.sin(y*.25)
                pixels.extend([max(0,min(1,c+grain)) for c in color]+[1])
        image.pixels.foreach_set(pixels); image.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
    return m
wall=material('Ruined masonry',(.36,.39,.34))
trim=material('Exposed brick',(.66,.67,.52))
metal=material('Ruin reinforcement',(.12,.17,.17),.45)
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
shared={}
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH': continue
    key=(tuple(m.name for m in o.data.materials),tuple(tuple(round(c,5) for c in v.co) for v in o.data.vertices))
    if key in shared: o.data=shared[key]
    else: shared[key]=o.data
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','ruin-wall.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','models','ruinWall.glb'),export_format='GLB',export_yup=True)
