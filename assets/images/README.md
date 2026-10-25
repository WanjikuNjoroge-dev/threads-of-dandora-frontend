# Responsive image assets

`source/` contains the locally cached, full-width JPEG downloads. The JPEG and
WebP files beside this README are generated from those sources and are intended
to be committed so the production page makes no remote image requests.

Run `npm run images` after changing `../image-sources.json`. Pass `-- --force`
to redownload sources and rebuild every variant. Use `-- --download-only` to
cache the source photos without loading Sharp.

The pipeline preserves each photograph's natural aspect ratio. Responsive page
wrappers are responsible for presentation crops through `object-fit` and the
`objectPosition` value recorded in the manifest.
