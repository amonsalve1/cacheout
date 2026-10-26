# pixeltracer

A CPU ray tracer engineered to output retro pixel art. **Zero dependencies** — it
runs on Node's native TypeScript support and its own PNG encoder, so there is no
build step, no bundler, and nothing to install.

```bash
npm run trace                  # -> tools/pixeltracer/out/pixel_art_render.png
npm run trace -- --help        # all flags
npm run trace:verify           # self-checking render loop, exits non-zero on failure
npm run trace:test             # unit tests (node:test)
```

## Pipeline

```
trace at native low-res (128x128, 1 spp, no AA)
  -> cel-shade inside the shader
  -> ordered dither
  -> palette snap
  -> nearest-neighbour upscale
  -> PNG
```

## Five decisions that matter

Most "3D pixel art" looks like a bad GIF rather than deliberate art because of
these. Each is a knob, not a hardcoded choice.

**Render at native low-res with no anti-aliasing.** Supersampling and then
downscaling is the reflex, and it is wrong here: soft edge pixels land between
palette entries, so the quantiser scatters them into halo colours and the pixel
grid dissolves. `--ssaa` exists for a deliberately soft look; the default is off.

**Perceptual colour distance (OKLab), not RGB euclidean.** Nearest-colour search
in raw RGB picks visually wrong entries and muddies everything. OKLab costs about
fifteen lines and is the single biggest quality lever in the pipeline.

**Cel-shade in the shader, not as a post-pass.** Banding a finished image throws
away light direction and flattens form. Banding the diffuse and specular *terms*
keeps the shape reading as 3D while still producing hard cel edges.

**Cel bands and dithering fight each other.** Band the lighting into four steps
*and* dither, and noise crawls over what should be flat colour. `--mode` selects
`cel`, `dither`, or `hybrid`; hybrid is the default and bands the diffuse while
leaving speculars and reflections for the ditherer.

**Bayer as a selector, not as noise.** For each pixel the quantiser finds the two
nearest palette entries, projects the true colour onto the axis between them, and
uses the Bayer threshold to pick one. Perturbing the colour and then snapping —
the naive version — can jump to a third unrelated entry and looks visibly dirtier.

## Why `--snap` exists

Without it, dithering fires across the entire frame: any large area whose colour
sits slightly off a palette entry gets a sparse dot field, and the result reads as
film grain over everything rather than as shading. `--snap` is an OKLab radius
inside which a pixel goes straight to its nearest entry.

The default of `0.07` was calibrated by measuring the actual distance from every
pixel to its nearest palette entry on the demo scene — the median is 0.045, and
0.07 snaps about 80% of pixels while leaving genuine gradients to dither.

## Detail budget

At 128px, anything finer than about 3 pixels becomes noise rather than detail. A
chip in the demo stack is roughly 4px tall, which is why each one is a flat colour
rather than carrying edge spots — 14 spots around the rim aliased into blotches.
Design to the budget rather than modelling detail the raster cannot hold.

## Verification

`npm run trace:verify` renders, reads the PNG back with our own decoder, and
asserts on real pixels. The load-bearing check is **palette membership**: if every
pixel is one of the declared colours, the quantiser provably worked. The rest
guard specific silent failures — an all-black frame, an interpolated upscale, a
nondeterministic render. Every stochastic path draws from a seeded PRNG, so two
runs are byte-identical.
