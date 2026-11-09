"""Deterministic layered matte export from project-owned transparent PNG illustrations.
Canvas 400x600 virtual coordinates scaled to each input size.
These parts support real limb motion while retaining the illustration.
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
base=Path(__file__).resolve().parent.parent/'assets'
output=base/'rig'
output.mkdir(exist_ok=True)
MATTE={
'fire':{
'src':'arena-king.png',
'weapon':[
 [(257,131),(293,141),(313,173),(347,188),(375,207),(373,247),(350,260),(319,244),(286,218),(260,198),(251,169)],
 [(348,-10),(392,-10),(396,83),(388,130),(376,160),(365,220),(354,296),(349,377),(345,455),(334,521),(309,512),(329,440),(324,361),(328,284),(320,236),(326,173),(331,123),(330,90)]
],
'guard':[
 [(106,105),(147,133),(164,175),(151,212),(123,248),(82,223),(69,189),(80,155)]
]},
'rune':{
'src':'rune-preview.png',
'weapon':[
 [(106,122),(157,140),(165,191),(151,224),(117,256),(78,246),(52,221),(74,179)],
 [(24,-10),(88,-10),(99,68),(83,106),(84,164),(95,220),(110,296),(127,388),(147,475),(159,524),(125,530),(108,438),(91,344),(78,254),(56,205),(53,158),(55,120),(29,89)]
],
'guard':[
 [(271,104),(314,122),(350,156),(360,202),(322,241),(284,239),(259,200),(260,145)]
]}}
for kind, spec in MATTE.items():
 im=Image.open(base/spec['src']).convert('RGBA')
 sx,sy=im.width/400, im.height/600
 alpha=im.getchannel('A')
 masks=[]
 for part in ['weapon','guard']:
  mask=Image.new('L', im.size,0)
  d=ImageDraw.Draw(mask)
  for p in spec[part]:d.polygon([(round(x*sx),round(y*sy)) for x,y in p],fill=255)
  mask=mask.filter(ImageFilter.GaussianBlur(2.5*sx))
  masks.append(mask)
  rgba=im.copy()
  from PIL import ImageChops
  rgba.putalpha(ImageChops.multiply(alpha,mask))
  rgba.save(output/f'{kind}-{part}.png', optimize=True)
  print(kind,part,round(mask.getbbox()[2]/sx))
 from PIL import ImageChops
 bodymask=Image.new('L',im.size,255)
 for mask in masks:
  inv=ImageChops.invert(mask)
  bodymask=ImageChops.multiply(bodymask,inv)
 body=im.copy(); body.putalpha(ImageChops.multiply(alpha,bodymask))
 body.save(output/f'{kind}-core.png', optimize=True)
 # reconstruction snapshot for checking masks partition roughly exactly original
 from PIL import Image as I
 recon=I.new('RGBA',im.size)
 recon.alpha_composite(body)
 for part in ['weapon','guard']:
  recon.alpha_composite(I.open(output/f'{kind}-{part}.png').convert('RGBA'))
 recon.thumbnail((400,600))
 recon.save(output/f'{kind}-reconstruction.png')
