// The art studio's prompts. Fixed in code so the endpoint never draws anything arbitrary.
// id -> { p: prompt, ref: id of the portrait to edit from (same character), size: 'WxH' }
const STYLE = ' Stylized realistic 3D render, Pixar-like proportions with real textures, soft cinematic light, crisp focus, high detail, centered, no text, no letters, no logos.';
const KEEP = ' Keep this exact same character: same face, same colours, same outfit details.' + STYLE;
const P = {
  // first portraits, one per candidate
  'lobstr-0': { p: 'A bright red lobster standing upright like a person, wearing a fluffy white hotel bathrobe, round sunglasses pushed up on its head, holding a pink cocktail with a tiny paper umbrella in one claw, relaxed half-closed eyes and a content little smile, waist-up portrait, turned three-quarters toward the camera, plain bright blue sky with soft white clouds behind.' + STYLE },
  'greg-0': { p: 'A grey city pigeon standing upright like an office worker, wearing a white short-sleeve dress shirt, a thin navy tie and a blue lanyard with a blank white ID badge, holding a paper coffee cup in one wing, tired deadpan expression, waist-up portrait, turned three-quarters toward the camera, plain soft beige office wall behind, fluorescent office light.' + STYLE },
  'shork-0': { p: 'A grey shark standing upright like a businessman, wearing a navy pinstripe suit, a red tie and a thin gold chain, holding a thick stack of banknotes in one fin, a sly toothy grin, waist-up portrait, turned three-quarters toward the camera, plain deep teal background, moody cinematic light.' + STYLE },
  'snel-0': { p: 'A small garden snail wearing a tiny red and white motorcycle racing helmet with the visor up, red and white racing stripes painted on its spiral shell, sitting proudly on a tiny red superbike, determined serious face, three-quarter view, plain bright blue sky behind.' + STYLE },
  'duk-0': { p: 'A mallard duck wearing an oversized puffy black down jacket zipped up to its beak, standing on a snowy frozen lake, calm unbothered half-closed eyes, waist-up portrait, turned three-quarters toward the camera, soft overcast winter light, a few falling snowflakes.' + STYLE },
  'hors-0': { p: 'A brown horse standing upright like a man at a backyard barbecue, wearing denim jean shorts and a white tank top, holding a grill spatula in one hoof, completely serious expression, waist-up portrait, turned three-quarters toward the camera, a sunny suburban backyard softly blurred behind.' + STYLE },
};
module.exports = { P, KEEP, STYLE };
