// Knot of the Day — what each knot is good for, plus the stories for newer knots.
// Merged into KNOTS by id.
const KNOT_USES = {
  overhand: {
    use: 'A quick stopper on a rope end',
    good: ['Stop a rope end from pulling out through a hole, grommet, or pulley', 'Keep a cut end from fraying for a while', 'The first step of many other knots'],
    notFor: 'Anything you’ll want to untie: it jams tight under load. It also weakens the rope more than most knots.',
  },
  figure8: {
    use: 'A stopper knot that’s easy to untie',
    good: ['A chunkier stopper on the end of a line', 'Unties easily even after a hard pull', 'The base of the figure-eight loop climbers use'],
    notFor: 'Joining two ropes or tying a rope to something. It only stops an end.',
  },
  square: {
    use: 'Tying a bundle or package closed',
    good: ['Tying around a bundle, a rolled-up rug, or a sack', 'First-aid bandages and slings (it lies flat)', 'Reefing a sail: tying the reef points'],
    notFor: 'Joining two ropes that will take a load. It can spill and slip apart; use a sheet bend.',
  },
  clove: {
    use: 'A quick, temporary tie to a post or rail',
    good: ['Fast tie to a post, piling, or rail', 'Hanging a fender from a boat rail', 'Starting a lashing'],
    notFor: 'Holding when the pull keeps changing direction or the post can turn: it can work loose. Add a half hitch to be safe.',
  },
  twohalf: {
    use: 'Tying a line to a ring, rail, or post',
    good: ['Tying off to a ring, rail, or eye bolt', 'Finishing off other knots (like the trucker’s hitch)', 'Clotheslines and light tarp lines'],
    notFor: 'Heavy, jerking loads. Use the round turn and two half hitches instead.',
  },
  roundturn: {
    use: 'A strong tie-off that can be tied under strain',
    good: ['Making a boat fast to a ring or piling', 'Hanging a heavy load from a rail or tree limb', 'Tying off while the line is already pulling'],
    notFor: 'A quick release: it takes a moment to untie.',
  },
  bowline: {
    use: 'A fixed loop that won’t slip or tighten',
    good: ['A loop to drop over a post, piling, or stake', 'Tying a line to a ring or a sail', 'A loop around something that must not cinch tighter'],
    notFor: 'Life-safety or climbing. It can shake loose when not under load, so leave a long tail.',
  },
  sheetbend: {
    use: 'Joining two ropes, even different sizes',
    good: ['Tying two ropes together into one longer one', 'Joining a thick rope to a thin one', 'Tying a line onto a loop or eye'],
    notFor: 'Very slick rope or ropes of very different sizes: take an extra turn (a double sheet bend).',
  },
  cleat: {
    use: 'Making a dock line fast to a cleat',
    good: ['Tying a boat to a dock cleat', 'Any horn cleat on a boat, trailer, or flagpole', 'Releases quickly when it’s time to cast off'],
    notFor: 'Extra wraps or hitches piled on: they jam it when you need it off fast.',
  },
  tautline: {
    use: 'A line you can tighten or loosen later',
    good: ['Awning and tarp tie-downs', 'Tent guy lines', 'A clothesline you can snug up as it stretches'],
    notFor: 'Heavy cargo, or slick modern rope under a big load: it can slip. Use a trucker’s hitch for loads.',
  },
  slip: {
    use: 'A quick loop that pulls tight and releases fast',
    good: ['A loop that cinches down around something', 'A quick-release tie: tug the tail and it’s gone', 'The pulley loop in a trucker’s hitch'],
    notFor: 'Anything around a person’s or animal’s neck, ever. It is not a secure, fixed loop.',
    summary: 'An overhand knot tied with a fold of rope instead of the end. It makes a loop that pulls tight, and the whole knot comes out with one tug on the tail.',
    sea: 'Sailors “slip” many knots this way: finish with a fold instead of the end, and one tug releases it.',
    rv: 'A quick-release tie for a bundle of cords or a tarp you’ll take down in the morning.',
    story: 'Show them the magic trick: pull the tail and the knot vanishes.',
  },
  fisherman: {
    use: 'Joining two thin lines',
    good: ['Joining fishing line, cord, or thin string', 'Slick or thin lines where other bends slip', 'Making an adjustable cord bracelet or necklace'],
    notFor: 'Thick rope, or anything you need to untie later: it jams. Use a sheet bend for rope.',
    summary: 'Two overhand knots, each tied around the other line. Pull the lines and the two knots slide together and lock.',
    sea: 'An old way to join small stuff (thin line) and fishing line aboard.',
    rv: 'Fixes a broken shade cord, drawstring, or fishing line.',
    story: 'Ever go fishing as a kid? Tell them about the one that got away.',
  },
  sheepshank: {
    use: 'Shortening a rope without cutting it',
    good: ['Taking up extra slack in a long line', 'Bypassing a worn spot: the damaged part in the middle carries no load', 'A classic knot for knot-tying practice and Navy tradition'],
    notFor: 'Anything that matters: it falls apart as soon as the line goes slack.',
    summary: 'A Z-shaped fold held at each end by a loop. It shortens a rope without cutting it, and the middle part can be worn or damaged.',
    sea: 'A traditional sailor’s knot for shortening a line or getting past a chafed spot until it could be spliced.',
    rv: 'Shortens a too-long rope for a quick job without cutting it.',
    story: 'Was there a knot every sailor had to learn in training? Show them how it’s tied.',
  },
  rolling: {
    use: 'Gripping a pole or another rope for a sideways pull',
    good: ['Pulling along a pole, rail, or another rope without sliding', 'Taking the strain off a jammed line so you can free it', 'Hanging something on a rail so it won’t slide'],
    notFor: 'Pulling the wrong way. It only grips when pulled toward the side with the two turns.',
    summary: 'A clove hitch with one extra turn. The extra turn lets it grip a pole or rope and hold a pull along its length.',
    sea: 'Used to take the load off a jammed sheet or anchor line by hitching a second line onto it.',
    rv: 'Grips a tent pole, awning arm, or another rope for a sideways pull.',
    story: 'Tell them about a time something jammed on the ship or the plane and how the crew sorted it out.',
  },
  constrictor: {
    use: 'Clamping something tight',
    good: ['Tying the neck of a bag or sack shut', 'Holding pieces together while glue sets', 'A quick hose clamp, or binding a rope end before cutting it'],
    notFor: 'Anything you want to untie: you often have to cut it off.',
    summary: 'A clove hitch with the end tucked under one more part. It bites down and won’t let go.',
    sea: 'Used for temporary whipping on a rope end and for seizings.',
    rv: 'Binds a frayed rope end, closes a trash or feed bag, or clamps a hose in a pinch.',
    story: 'Show them how hard it grips: let them try to pull it loose.',
  },
  trucker: {
    use: 'Cinching a load down tight',
    good: ['Tying down a load on a trailer or truck', 'Tightening a ridgeline for a tarp', 'About 3 times the pull of your arms in theory (friction takes some of that)'],
    notFor: 'Heavy loads going down the highway. Rope wears where it runs through the loop; use rated ratchet straps for those.',
    summary: 'A slip-knot loop in the line acts like a pulley. Run the end around the tie-down point, back through the loop, and pull: it multiplies your pull. Tie it off with two half hitches.',
    sea: 'Sailors used the same pulley idea for hauling with tackle.',
    rv: 'Snug a tarp, ladder, firewood, or bikes down on the truck or trailer.',
    story: 'What’s the biggest load you ever hauled or tied down? Tell them how you did it.',
  },
};
KNOTS.forEach(k => Object.assign(k, KNOT_USES[k.id] || {}));
