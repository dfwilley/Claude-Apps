// Knot of the Day — knot library.
// strands[].pts: rope control points (0..320 drawing box). x: over/under string.
// steps[].r: how much of each strand is laid at that step (control-point index).
// The arrow on each step shows the move to the next step.
const RAIL = `<defs><linearGradient id="g-rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ced6"/><stop offset=".45" stop-color="#8d96a3"/><stop offset="1" stop-color="#4c5561"/></linearGradient></defs>
<rect x="-5" y="62" width="330" height="30" rx="4" fill="url(#g-rail)" stroke="#2f363f" stroke-width="2"/>`;
const POST = `<defs><linearGradient id="g-post" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b4a2b"/><stop offset=".4" stop-color="#a87a4c"/><stop offset="1" stop-color="#5a3d22"/></linearGradient></defs>
<rect x="128" y="-5" width="66" height="330" fill="url(#g-post)" stroke="#3a2614" stroke-width="2"/>
<path d="M146 0V320M172 0V320" stroke="#7d5733" stroke-width="1.5" opacity=".6"/>`;
const STAKE = `<rect x="-5" y="298" width="330" height="30" fill="#c9a77a"/><path d="M0 298H320" stroke="#8a6a44" stroke-width="2"/>
<path d="M152 256 H168 V304 L160 318 L152 304 Z" fill="#cfd4da" stroke="#3b4148" stroke-width="2"/>
<rect x="138" y="246" width="44" height="11" rx="3" fill="#9aa1aa" stroke="#3b4148" stroke-width="2"/>`;
const CLEAT = `<defs><linearGradient id="g-cleat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e6ea"/><stop offset=".5" stop-color="#a3aab4"/><stop offset="1" stop-color="#5e6670"/></linearGradient></defs>
<rect x="134" y="138" width="52" height="44" rx="8" fill="#6b737d" stroke="#2f363f" stroke-width="2"/>
<path d="M78 152 Q80 146 92 146 L228 146 Q240 146 242 152 L242 168 Q240 174 228 174 L92 174 Q80 174 78 168 Z" fill="url(#g-cleat)" stroke="#2f363f" stroke-width="2"/>`;
const DOCK = `<rect x="0" y="0" width="320" height="320" fill="#d9c6a5"/><path d="M0 64H320M0 128H320M0 192H320M0 256H320" stroke="#b49c74" stroke-width="3"/>`;

const KNOTS = [
  {
    id: 'overhand', name: 'Overhand Knot', also: 'Thumb knot',
    level: 1, needs: [],
    summary: 'The simplest knot there is, and the start of many others. It makes a quick stopper so a rope end won’t slip through a hole or block.',
    sea: 'Sailors tie it in a line end to keep it from running out through a block. It is also the first half of the square knot.',
    rv: 'A fast stopper on a cord end so it won’t pull back through a grommet on a tarp or awning.',
    story: 'Who first taught you to tie a knot? Tell the grandkids about it.',
    strands: [{
      color: 'tan',
      pts: [[-10, 262], [40, 245], [95, 222], [145, 198], [195, 166], [232, 122], [222, 74], [178, 52], [132, 68], [112, 112], [128, 160], [150, 212], [178, 256], [220, 262], [240, 230], [222, 190], [200, 158], [170, 128], [130, 118], [85, 112], [40, 104], [5, 100]],
      x: 'ouo',
    }],
    steps: [
      { r: [4], t: 'Bring the working end (the free end) up and around to make a loop, crossing over the standing part.' },
      { r: [11], t: 'Take the end around behind the standing part.' },
      { r: [15], t: 'Pass the end up through the loop and out the other side.' },
      { r: [21], t: 'Pull both ends to snug it tight. That\u2019s an overhand knot.' },
    ],
  },
  {
    id: 'figure8', name: 'Figure-Eight Knot', also: 'Flemish knot',
    level: 1, needs: ['overhand'],
    summary: 'A chunkier stopper knot shaped like the number 8. It holds better than an overhand and is much easier to untie.',
    sea: 'The standard stopper on the end of a sheet (the line that trims a sail) so it can’t run out through its block.',
    rv: 'A good stopper on a pull cord or the end of a tie-down strap line.',
    story: 'Show them the 8. Ask the grandkids what number they see in the rope.',
    strands: [{
      color: 'tan',
      pts: [[-10, 230], [50, 226], [105, 218], [160, 200], [205, 168], [225, 122], [205, 82], [160, 70], [122, 92], [112, 138], [122, 190], [130, 232], [118, 268], [80, 282], [48, 262], [50, 225], [72, 190], [112, 168], [150, 162], [176, 192], [198, 236], [214, 280], [222, 315]],
      x: 'ouou',
    }],
    steps: [
      { r: [4], t: 'Make a loop, crossing the working end over the standing part.' },
      { r: [11], t: 'Take the end all the way around behind the standing part.' },
      { r: [16], t: 'Bring the end up and pass it down through the loop from the front.' },
      { r: [22], t: 'Pull it snug. Look for the figure 8 shape.' },
    ],
  },
  {
    id: 'square', name: 'Square Knot', also: 'Reef knot',
    level: 1, needs: ['overhand'],
    summary: 'Ties two rope ends together around something, like a bundle. Remember: right over left, then left over right.',
    sea: 'Its old name is the reef knot: sailors used it to tie the reef points that bunch up part of a sail in strong wind.',
    rv: 'Good for tying a bundle, a rolled-up rug, or a bag closed. Do not trust it to join two ropes under heavy load: use a sheet bend for that.',
    story: 'Tell them about tying knots in the Navy. Did anyone ever make you tie one blindfolded?',
    strands: [
      { color: 'tan', pts: [[-10, 92], [50, 104], [110, 116], [160, 127], [205, 138], [235, 145], [252, 165], [235, 186], [205, 193], [160, 204], [110, 215], [50, 227], [-10, 239]] },
      { color: 'navy', pts: [[330, 150], [285, 150], [250, 152], [222, 150], [192, 130], [155, 95], [110, 72], [68, 82], [50, 165], [68, 248], [110, 258], [155, 235], [192, 200], [222, 180], [250, 178], [285, 180], [330, 180]], x: 'ouououo' },
    ],
    steps: [
      { r: [12, 0], t: 'Make a U-shape (a bight) in the tan rope. Bring the blue end in over the bend of the U\u2026' },
      { r: [12, 3], t: '\u2026pass it under the top tan leg\u2026' },
      { r: [12, 5], t: '\u2026around the outside of both tan legs\u2026' },
      { r: [12, 10], t: '\u2026and back out through the U, right beside where it came in.' },
      { r: [12, 16], t: 'Pull all four parts snug. Each rope\u2019s two parts lie side by side: that\u2019s how you know it\u2019s a square knot, not a granny.' },
    ],
  },
  {
    id: 'clove', name: 'Clove Hitch', also: '',
    level: 1, needs: [],
    summary: 'A quick hitch to tie a rope to a post or rail. Two turns, with the end tucked under the X.',
    sea: 'A fast way to hang a fender from a rail or make a line fast to a piling for a short stop.',
    rv: 'Handy for tying a line to a tree or pole for a clothesline. It can slip if the pull keeps changing direction, so add a half hitch for safety.',
    story: 'Where have you tied up a boat? Tell them about a dock or a pier you remember.',
    obj: POST,
    behind: [[0, 5.15, 7.9], [0, 13.15, 15.9]],
    strands: [{
      color: 'tan',
      pts: [[-10, 218], [60, 217], [110, 216], [160, 214], [192, 210], [207, 198], [180, 170], [140, 140], [120, 124], [140, 126], [158, 160], [174, 200], [190, 238], [207, 244], [182, 215], [145, 180], [120, 166], [145, 166], [175, 166], [208, 166], [250, 167], [330, 168]],
      x: 'ou',
    }],
    steps: [
      { r: [3], t: 'Take the end around the post.' },
      { r: [9], t: 'Cross over the standing part, making an X, and go around the post again.' },
      { r: [17], t: 'Tuck the end under the X.' },
      { r: [21], t: 'Pull both ends to snug it up. Both ends come out from under the X, going opposite ways.' },
    ],
  },
  {
    id: 'twohalf', name: 'Two Half Hitches', also: '',
    level: 1, needs: ['overhand'],
    summary: 'A simple, secure way to tie a rope to a rail, ring, or post. Each half hitch wraps the standing part and tucks through itself.',
    sea: 'A quick way to make a line fast to a ring, piling, or rail.',
    rv: 'Good for tying a tarp line or a clothesline to a rail or a ring on the trailer.',
    story: 'What was the knot you tied most in the Navy? Tell them where you used it.',
    obj: RAIL,
    behind: [[0, 6.5, 8.6]],
    strands: [{
      color: 'tan',
      pts: [[120, 335], [120, 280], [120, 220], [120, 150], [121, 100], [127, 66], [145, 44], [165, 52], [175, 80], [180, 108], [183, 135], [175, 158], [140, 165], [100, 166], [82, 178], [98, 192], [135, 194], [158, 184], [162, 160], [168, 138], [200, 140], [205, 180], [180, 212], [140, 218], [100, 220], [82, 232], [98, 246], [135, 248], [158, 238], [162, 214], [166, 194]],
      x: 'uououou',
    }],
    steps: [
      { r: [4], t: 'Pass the end over the rail and around it.' },
      { r: [10], t: 'Take the end behind the standing part…' },
      { r: [14], t: '…around the front, and up through the loop you just made. That’s one half hitch.' },
      { r: [19], t: 'Make a second half hitch just below the first, going around the same way.' },
      { r: [30], t: 'Slide the hitches up snug against the rail.' },
    ],
  },
  {
    id: 'roundturn', name: 'Round Turn & Two Half Hitches', also: '',
    level: 2, needs: ['twohalf'],
    summary: 'Two half hitches with an extra turn around the rail first. The round turn takes the strain, so you can tie it even while the line is pulling hard.',
    sea: 'A classic for making a boat fast to a ring or piling, and for hanging a load.',
    rv: 'A strong tie-off for a heavy tarp, a load on the trailer, or a hammock line around a tree.',
    story: 'Was there ever a line you had to hold under strain while somebody tied it off? Tell that one.',
    obj: RAIL,
    behind: [[0, 6.5, 8.6], [0, 14.5, 16.6]],
    strands: [{
      color: 'tan',
      pts: [[105, 335], [105, 280], [105, 220], [105, 150], [106, 100], [112, 66], [128, 44], [146, 54], [150, 80], [146, 100], [150, 114], [162, 108], [166, 90], [170, 64], [186, 44], [204, 54], [208, 80], [210, 105], [212, 132], [204, 156], [165, 164], [120, 166], [85, 166], [68, 178], [84, 192], [125, 195], [150, 186], [156, 160], [166, 140], [230, 145], [232, 182], [205, 212], [160, 218], [85, 220], [68, 232], [84, 246], [125, 250], [150, 240], [158, 214], [162, 194]],
      x: 'uououou',
    }],
    steps: [
      { r: [4], t: 'Pass the end over the rail and take it around twice. That’s the round turn.' },
      { r: [19], t: 'Take the end behind the standing part, around the front, and up through the loop: first half hitch.' },
      { r: [28], t: 'Make a second half hitch just below, going around the same way.' },
      { r: [39], t: 'Snug it up. The round turn holds the load; the hitches lock it.' },
    ],
  },
  {
    id: 'bowline', name: 'Bowline', also: 'King of knots',
    level: 2, needs: ['overhand'],
    summary: 'Makes a loop at the end of a rope that won’t slip or tighten, and still unties easily after a heavy load. \u201CThe rabbit comes up the hole, around the tree, and back down the hole.\u201D',
    sea: 'Often called the king of knots. Sailors use it to put a loop over a piling or bollard, or to tie a sheet to a sail.',
    rv: 'Put a fixed loop over a hitch ball, a stake, or a tree for a tie-down that won’t cinch tight.',
    story: 'Teach them the rabbit and the tree. Make up your own version of the story.',
    strands: [{
      color: 'tan',
      pts: [[150, -10], [150, 30], [150, 65], [152, 100], [170, 128], [163, 160], [136, 168], [110, 152], [106, 120], [124, 98], [152, 92], [184, 104], [208, 150], [218, 210], [200, 262], [150, 290], [100, 272], [82, 225], [92, 190], [112, 176], [124, 148], [126, 118], [126, 84], [132, 56], [150, 44], [172, 48], [184, 66], [174, 98], [154, 124], [146, 150], [146, 182], [148, 205]],
      x: 'ououoou',
    }],
    steps: [
      { r: [3], t: 'Make a small loop in the standing part, with the rope toward the end crossing on top. This is the rabbit hole.' },
      { r: [11], t: 'Leave a big loop the size you want. The rabbit comes up through the hole…' },
      { r: [22], t: '…around behind the tree (the standing part)…' },
      { r: [26], t: '…and back down the hole.' },
      { r: [31], t: 'Hold the end against the loop and pull the standing part to set it.' },
    ],
  },
  {
    id: 'sheetbend', name: 'Sheet Bend', also: 'Becket bend',
    level: 2, needs: ['bowline'],
    summary: 'The best way to join two ropes, even if one is thicker than the other. Tied a lot like a bowline.',
    sea: 'Named for the sheets (the lines that work a sail). Used to bend a line onto a loop or another line.',
    rv: 'Joins two short ropes into one long one when a tie-down comes up short.',
    story: 'Ask the grandkids to hold the blue rope while you tie on the tan one.',
    strands: [
      { color: 'navy', pts: [[-10, 120], [60, 120], [150, 120], [210, 122], [236, 138], [242, 158], [232, 180], [210, 190], [150, 192], [60, 192], [-10, 192]] },
      { color: 'tan', pts: [[180, 335], [180, 270], [180, 215], [180, 160], [178, 100], [158, 72], [120, 72], [100, 100], [98, 150], [100, 205], [112, 240], [140, 244], [150, 214], [160, 180], [192, 160], [214, 156]], x: 'uouuou' },
    ],
    steps: [
      { r: [10, 1], t: 'Make a U-shape (a bight) in the thicker blue rope. Bring the tan end up through it from behind.' },
      { r: [10, 5], t: 'Take the tan end around behind both legs of the U.' },
      { r: [10, 11], t: 'Tuck it under itself, but over the U.' },
      { r: [10, 15], t: 'Hold the U and pull the tan standing part to tighten.' },
    ],
  },
  {
    id: 'cleat', name: 'Cleat Hitch', also: '',
    level: 1, needs: ['clove'],
    summary: 'How to tie a boat to a dock cleat: a turn around the base, a figure eight over the top, and a locking hitch.',
    sea: 'Every dock line ends up on a cleat. A neat cleat hitch is a sign of a good sailor.',
    rv: 'Some trailers and toy haulers have cleats or tie-down horns that work the same way.',
    story: 'Tell them about a boat you tied up, or the biggest ship you ever saw made fast.',
    bg: DOCK,
    obj: CLEAT,
    behind: [[0, 4.45, 5.6], [0, 11.45, 12.55]],
    strands: [{
      color: 'tan',
      pts: [[-10, 300], [60, 265], [130, 234], [178, 212], [198, 192], [201, 160], [198, 130], [186, 116], [160, 138], [126, 172], [106, 196], [93, 186], [94, 160], [102, 134], [122, 120], [160, 148], [200, 178], [232, 198], [258, 188], [268, 160], [256, 136], [234, 132], [224, 156], [230, 184], [238, 212], [246, 240]],
      x: 'oou',
    }],
    steps: [
      { r: [3], t: 'Lead the line to the far horn and take a turn around the base.' },
      { r: [7], t: 'Cross over the top and pass it under the other horn.' },
      { r: [14], t: 'Cross back over the top, making an X (a figure eight).' },
      { r: [17], t: 'Make an underhand loop and drop it over the horn so the end tucks under.' },
      { r: [25], t: 'Pull the end snug. Line made fast.' },
    ],
  },
  {
    id: 'tautline', name: 'Taut-Line Hitch', also: 'Tent-line hitch',
    level: 2, needs: ['twohalf'],
    summary: 'An adjustable loop for a line to a stake. Slide the hitch to tighten or loosen the line, and it holds where you leave it.',
    sea: 'Close cousin of the rolling hitch, used to grab a line and hold it under tension.',
    rv: 'Perfect for awning tie-downs, tarp guy lines, and tent lines at camp. Tighten them up after the evening wind dies down.',
    story: 'Where was your favorite place you ever camped? Tell them about it.',
    obj: STAKE,
    behind: [[0, 6.3, 6.95]],
    strands: [{
      color: 'tan',
      pts: [[110, -10], [110, 40], [110, 90], [110, 150], [111, 220], [122, 262], [140, 276], [172, 276], [196, 262], [210, 225], [213, 170], [208, 128], [190, 113], [150, 120], [110, 128], [84, 136], [76, 150], [90, 158], [110, 161], [140, 163], [162, 172], [150, 184], [110, 188], [84, 194], [76, 208], [90, 216], [110, 218], [140, 219], [166, 214], [182, 190], [186, 150], [182, 110], [168, 84], [140, 76], [110, 74], [84, 80], [76, 94], [90, 102], [110, 104], [140, 104], [165, 100], [195, 94], [232, 86]],
      x: 'ououoouu',
    }],
    steps: [
      { r: [4], t: 'Pass the end around the stake and back up.' },
      { r: [12], t: 'Wrap the end twice around the standing part, working down toward the stake (inside the loop).' },
      { r: [28], t: 'Bring the end up across the front of the wraps and tie one more half hitch above them (outside the loop).' },
      { r: [42], t: 'Snug the wraps. Slide the hitch up to tighten the line, down to loosen it.' },
    ],
  },
];
if (typeof module !== 'undefined') module.exports = KNOTS;
