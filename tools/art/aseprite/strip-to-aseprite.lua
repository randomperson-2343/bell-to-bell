-- Builds an indexed .aseprite from a horizontal strip of frames.
-- aseprite -b --script-param strip=<in.png> --script-param fw=<frame width>
--   --script-param out=<out.aseprite> --script-param palette=<faded-power.gpl>
--   --script-param tags=open,closed --script-param layer=<layer name>
--   --script tools/art/aseprite/strip-to-aseprite.lua
-- Palette index 0 is transparent; 1..32 are the locked Faded Power colours.
local p = app.params
local strip = Image{ fromFile = p.strip }
local fw = tonumber(p.fw)
local fh = strip.height
local n = math.floor(strip.width / fw)

local pal = Palette{ fromFile = p.palette }
local full = Palette(pal and (#pal + 1) or 33)
full:setColor(0, Color{ r = 0, g = 0, b = 0, a = 0 })
for i = 0, #pal - 1 do full:setColor(i + 1, pal:getColor(i)) end

local spr = Sprite(fw, fh, ColorMode.INDEXED)
spr.transparentColor = 0
spr:setPalette(full)
spr.layers[1].name = p.layer or 'art'
for i = 2, n do spr:newEmptyFrame() end

local function index(px)
  local a = app.pixelColor.rgbaA(px)
  if a < 128 then return 0 end
  local r, g, b = app.pixelColor.rgbaR(px), app.pixelColor.rgbaG(px), app.pixelColor.rgbaB(px)
  for i = 1, #full - 1 do
    local c = full:getColor(i)
    if c.red == r and c.green == g and c.blue == b then return i end
  end
  error(string.format('colour %02x%02x%02x is not in the palette', r, g, b))
end

for f = 1, n do
  local img = Image(fw, fh, ColorMode.INDEXED)
  img:clear(0)
  for y = 0, fh - 1 do
    for x = 0, fw - 1 do
      img:drawPixel(x, y, index(strip:getPixel((f - 1) * fw + x, y)))
    end
  end
  spr:newCel(spr.layers[1], spr.frames[f], img, Point(0, 0))
end

local names = {}
for t in string.gmatch(p.tags or '', '[^,]+') do table.insert(names, t) end
for i, name in ipairs(names) do
  if i <= n then local t = spr:newTag(i, i); t.name = name end
end

spr:saveAs(p.out)
