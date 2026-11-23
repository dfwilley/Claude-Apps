// Sketch Match: the drawings to copy, and the rules that don't need a screen (so they can be tested with Node).
// Every picture is drawn here in code as simple line art on a 200 x 200 square, so the app needs no image files.
(function (root) {
  "use strict";

  const INK = "#22252e";
  // The same shape again, flipped left-to-right, for pictures that are the same on both sides.
  const both = (half) => half + `<g transform="translate(200 0) scale(-1 1)">${half}</g>`;
  const dot = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}" stroke="none"/>`;
  function star(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
      pts.push((cx + rr * Math.cos(a)).toFixed(1) + "," + (cy + rr * Math.sin(a)).toFixed(1));
    }
    return `<polygon points="${pts.join(" ")}"/>`;
  }
  const cloud = (x, y) => `<path d="M${x} ${y} h44 c8 0 8 -12 -2 -12 c0 -12 -16 -14 -20 -4 c-4 -8 -16 -4 -14 4 c-12 -2 -16 12 -8 12 Z"/>`;
  const gull = (x, y) => `<path d="M${x} ${y} q5 -7 10 0 q5 -7 10 0"/>`;

  // Evenly spaced spokes of a wheel, and a ring of pointed petals around the middle of the page (for the mandala).
  function spokes(cx, cy, r, n) {
    let p = "";
    for (let i = 0; i < n; i++) { const a = (i * Math.PI) / n, x = (r * Math.cos(a)).toFixed(1), y = (r * Math.sin(a)).toFixed(1); p += `M${(cx - x).toFixed(1)} ${(cy - y).toFixed(1)} L${(cx + +x).toFixed(1)} ${(cy + +y).toFixed(1)} `; }
    return `<path d="${p.trim()}" stroke-width="1.4"/>`;
  }
  function petals(n, r0, r1, spread, turn) {
    const at = (r, a) => (100 + r * Math.cos(a)).toFixed(1) + " " + (100 + r * Math.sin(a)).toFixed(1);
    let p = "";
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + turn + (i * 2 * Math.PI) / n, mid = (r0 + r1) / 2; p += `M${at(r0, a)} Q${at(mid, a - spread)} ${at(r1, a)} Q${at(mid, a + spread)} ${at(r0, a)} `; }
    return `<path d="${p.trim()}"/>`;
  }
  function ringOfDots(n, r, size) {
    let s = "";
    for (let i = 0; i < n; i++) { const a = (i * 2 * Math.PI) / n; s += `<circle cx="${(100 + r * Math.cos(a)).toFixed(1)}" cy="${(100 + r * Math.sin(a)).toFixed(1)}" r="${size}"/>`; }
    return s;
  }

  const LEVELS = { easy: "Easy", medium: "Medium", tricky: "Tricky", expert: "Expert" };

  const DRAWINGS = [
    { id: "cupcake", name: "Cupcake", level: "easy", about: "a cupcake in a pleated paper case with swirled frosting, sprinkles and a cherry on top",
      steps: ["Start with the paper case: a box that is wider at the top than the bottom.", "Add the frosting as three bumpy layers, each a little narrower than the one below.", "Finish with the cherry, its stem, the pleat lines and a few sprinkles."],
      art: `<path d="M62 112 L74 172 H126 L138 112 Z"/><path d="M81 112 L86 172 M100 112 V172 M119 112 L114 172"/>
        <path d="M56 112 C48 98 60 86 72 90 C66 76 82 66 94 72 C96 58 114 58 116 70 C130 66 138 80 130 90 C144 88 152 102 144 112 Z"/>
        <circle cx="104" cy="52" r="10"/><path d="M106 43 C108 34 114 30 121 29"/>
        <path d="M78 100 l6 -3 M96 84 l5 4 M118 98 l6 2 M108 102 l-5 3 M84 82 l4 4 M122 84 l-5 3"/>` },
    { id: "tulip", name: "Tulip", level: "easy", about: "a single tulip with a cup-shaped flower of three petals, a long stem and two pointed leaves",
      steps: ["Draw the flower as a cup with three points along the top; the middle point is the tallest.", "Draw the stem straight down from the middle of the cup.", "Add one long leaf on each side, wide in the middle and pointed at the tip."],
      art: `<path d="M76 62 C70 88 84 106 100 106 C116 106 130 88 124 62 C118 76 110 72 100 44 C90 72 82 76 76 62 Z"/>
        <path d="M89 66 C88 84 92 98 100 106 M111 66 C112 84 108 98 100 106"/>
        <path d="M100 106 C99 130 100 160 100 190"/>
        <path d="M100 176 C82 166 66 146 62 118 C80 128 96 148 100 176 Z"/><path d="M100 156 C118 148 134 130 138 104 C120 114 104 132 100 156 Z"/>` },
    { id: "moon", name: "Moon and Stars", level: "easy", about: "a crescent moon with three five-pointed stars of different sizes and a small cloud below",
      steps: ["Draw a big backwards C for the outside of the moon.", "Add a second, flatter curve inside it so the two curves meet in sharp points.", "Add three stars (big, medium, small) and the little cloud."],
      art: `<path d="M112 34 A62 62 0 1 0 150 142 A59 59 0 0 1 112 34 Z"/>${star(150, 60, 16)}${star(128, 100, 9)}${star(168, 104, 7)}${cloud(100, 180)}` },
    { id: "mushroom", name: "Mushrooms", level: "easy", about: "a big spotted mushroom with a domed cap and a thick stem, a small mushroom beside it, and tufts of grass",
      steps: ["Draw the big cap: a dome on top with a gently curved bottom edge.", "Add the stem, a little wider at the ground than under the cap.", "Add the spots, then the small mushroom and the grass."],
      art: `<path d="M36 108 C36 54 152 54 152 108 C132 118 56 118 36 108 Z"/><path d="M76 115 C76 140 72 158 66 176 H122 C116 158 112 140 112 115"/>
        <circle cx="70" cy="86" r="9"/><circle cx="104" cy="78" r="11"/><circle cx="130" cy="96" r="6"/><circle cx="88" cy="102" r="4"/>
        <path d="M136 150 C136 130 178 130 178 150 C168 155 146 155 136 150 Z"/><path d="M152 154 C152 164 150 170 148 176 H166 C164 170 162 164 162 154"/>
        <path d="M24 176 H186 M38 176 l-4 -12 M38 176 l4 -10 M128 176 l-3 -10 M128 176 l5 -12"/>` },
    { id: "cactus", name: "Cactus", level: "easy", about: "a cactus with two curved arms and a small flower on top, growing in a flowerpot with a rim",
      steps: ["Draw the pot first: a rim on top and sides that slope inward.", "Draw the tall body with a rounded top, then one arm on each side at different heights.", "Add the flower on top and short lines for the spines."],
      art: `<rect x="64" y="124" width="72" height="13" rx="3"/><path d="M70 137 L78 180 H122 L130 137"/>
        <path d="M86 124 V66 C86 46 114 46 114 66 V124"/>
        <path d="M86 108 C68 108 60 100 60 84 C60 74 74 74 74 84 C74 91 79 94 86 94"/>
        <path d="M114 98 C132 98 140 90 140 72 C140 62 126 62 126 72 C126 80 121 84 114 84"/>
        <circle cx="100" cy="42" r="5"/><path d="M95 40 C86 36 88 28 96 34 M105 40 C114 36 112 28 104 34 M97 37 C94 26 106 26 103 37"/>
        <path d="M96 64 v8 M104 80 v8 M96 96 v8 M104 112 v6 M66 88 h4 M130 76 h4"/>` },
    { id: "whale", name: "Whale", level: "easy", about: "a happy whale seen from the side with a rounded body, an upturned tail with two flukes, a small fin, an eye, a smile and a spout of water",
      steps: ["Draw the body like a big bean that gets thinner towards the tail.", "Add the tail: two leaf shapes that meet in a V.", "Add the eye, the smile, the fin, the belly line and the spout."],
      art: `<path d="M28 112 C28 74 76 60 112 66 C136 70 150 84 160 80 C150 70 150 54 158 46 C162 58 168 64 176 62 C184 60 188 52 190 48 C192 66 184 84 172 92 C160 124 124 146 86 144 C52 142 28 134 28 112 Z"/>
        ${dot(58, 100, 4)}<path d="M36 116 C46 126 60 126 68 118"/><path d="M92 122 C96 134 108 138 118 132 C112 128 108 124 106 118"/>
        <path d="M40 132 C70 124 110 124 150 110"/>
        <path d="M84 60 V46 M84 46 C84 36 74 32 68 38 M84 46 C84 36 94 32 100 38"/>` },
    { id: "cat", name: "Sitting Cat", level: "medium", about: "a cat sitting and facing forward, with pointed ears, big eyes, whiskers, two front legs and a tail curling up on the right",
      steps: ["Draw the head as a wide oval and add two triangle ears.", "Draw the body below it like a pear, wider at the bottom, then the two front legs.", "Add the curled tail, then the face: eyes level with each other, nose in the middle."],
      art: `<ellipse cx="100" cy="70" rx="33" ry="28"/><path d="M73 54 L69 24 L92 44 M127 54 L131 24 L108 44"/>
        <path d="M78 92 C56 120 54 158 70 178 H130 C146 158 144 120 122 92"/>
        <path d="M90 178 V138 M110 178 V138 M82 178 C82 170 90 170 90 178 M110 178 C110 170 118 170 118 178"/>
        <path d="M136 168 C164 170 170 138 152 126 C144 121 138 130 146 137"/>
        <ellipse cx="87" cy="68" rx="4.5" ry="6.5" fill="${INK}" stroke="none"/><ellipse cx="113" cy="68" rx="4.5" ry="6.5" fill="${INK}" stroke="none"/>
        <path d="M96 78 H104 L100 83 Z" fill="${INK}"/><path d="M100 83 C98 89 92 89 90 85 M100 83 C102 89 108 89 110 85"/>
        <path d="M76 77 L54 72 M76 82 L54 86 M124 77 L146 72 M124 82 L146 86"/>` },
    { id: "butterfly", name: "Butterfly", level: "medium", about: "a butterfly seen from above with wings open: a slim body, two curled antennae, two large upper wings and two smaller lower wings, each with round spots, the same on both sides",
      steps: ["Draw the slim body down the middle and the two antennae.", "Draw one upper wing and one lower wing on the right side.", "Now match them on the left side as closely as you can, then add the spots."],
      art: `<ellipse cx="100" cy="102" rx="5" ry="30"/>` + both(`<path d="M103 74 C108 56 118 48 126 52"/><path d="M105 90 C120 50 172 38 178 70 C182 98 142 110 105 104"/>
        <path d="M105 108 C140 112 162 132 152 154 C140 172 112 152 105 122"/><circle cx="150" cy="72" r="10"/><circle cx="126" cy="84" r="5"/><circle cx="134" cy="138" r="8"/>`) },
    { id: "sailboat", name: "Sailboat", level: "medium", about: "a sailboat on the sea with a tall mast, a large triangular sail on the right, a smaller one on the left, a small flag, waves under the hull and a sun with rays in the top left corner",
      steps: ["Draw the hull: a long shape, flat on top, that slopes in at both ends.", "Draw the mast straight up from the middle, then a big triangle sail on the right and a smaller one on the left.", "Add the flag, the waves and the sun."],
      art: `<path d="M38 140 H162 L146 164 H56 Z"/><path d="M100 140 V34"/><path d="M105 46 L152 132 H105 Z"/><path d="M95 60 L58 132 H95 Z"/><path d="M100 34 L116 39 L100 44"/>
        <path d="M20 176 q10 -9 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/><path d="M30 190 q10 -9 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/>
        <circle cx="40" cy="42" r="13"/><path d="M40 20 v-8 M40 64 v8 M18 42 h-8 M62 42 h8 M25 27 l-6 -6 M55 27 l6 -6 M25 57 l-6 6 M55 57 l6 6"/>` },
    { id: "balloon", name: "Hot Air Balloon", level: "medium", about: "a hot air balloon with a large rounded envelope divided by curved seams, a small basket hanging from two ropes, a cloud and two birds",
      steps: ["Draw the balloon like an upside-down teardrop with a flat bottom.", "Add the curved seams from the top to the bottom opening, then the ropes and the basket.", "Add the cloud and the two birds."],
      art: `<path d="M100 22 C54 22 38 62 46 92 C52 116 80 134 88 148 H112 C120 134 148 116 154 92 C162 62 146 22 100 22 Z"/>
        <path d="M100 22 C84 52 82 112 95 148 M100 22 C116 52 118 112 105 148 M100 22 C64 46 60 104 88 148 M100 22 C136 46 140 104 112 148"/>
        <path d="M90 148 V164 M110 148 V164"/><rect x="87" y="164" width="26" height="18" rx="3"/><path d="M87 172 H113"/>
        ${cloud(14, 156)}${gull(150, 150)}${gull(166, 136)}` },
    { id: "fox", name: "Fox Face", level: "tricky", about: "the face of a fox seen from the front, the same on both sides: tall pointed ears with inner ears, a head that narrows to a point at the chin, pale cheek patches, almond eyes and a dark nose at the tip of the snout",
      steps: ["Lightly draw a line down the middle of your page so both sides can match.", "Draw the outline: ears up and out, cheeks at the widest point, then down to the chin.", "Add the inner ears, the curved cheek lines, the eyes and the nose."],
      art: both(`<path d="M100 62 C112 60 118 62 122 66 L156 36 L150 104 L100 164"/><path d="M130 68 L148 52 L144 88"/>
        <path d="M150 104 C132 110 112 126 104 152"/><path d="M112 98 C118 90 128 90 132 96 C126 102 118 102 112 98 Z"/>${dot(122, 96, 3)}`) +
        `<ellipse cx="100" cy="156" rx="8" ry="6" fill="${INK}" stroke="none"/>` },
    { id: "owl", name: "Owl", level: "tricky", about: "an owl sitting on a branch, facing forward: an egg-shaped body, two ear tufts, two large round eyes with dark pupils, a small diamond beak, folded wings at the sides, rows of U-shaped chest feathers, and feet gripping the branch",
      steps: ["Draw the egg-shaped body and the two ear tufts.", "Place the two big eyes side by side so they touch the middle, with the beak between and just below them.", "Add the wings, the rows of chest feathers, the branch and the feet."],
      art: `<ellipse cx="100" cy="102" rx="44" ry="56"/>` + both(`<path d="M128 58 L140 36 L112 48"/><circle cx="118" cy="80" r="17"/>${dot(116, 80, 7)}
        <path d="M140 92 C152 124 140 148 124 154"/><path d="M104 158 v10 M112 158 v10 M120 157 v11"/>`) +
        `<path d="M100 92 L107 100 L100 110 L93 100 Z"/><path d="M82 118 q6 8 12 0 q6 8 12 0 q6 8 12 0 M88 132 q6 8 12 0 q6 8 12 0 M82 146 q6 8 12 0 q6 8 12 0 q6 8 12 0"/>
        <path d="M22 164 C60 160 140 160 180 166 M150 164 C160 156 172 154 178 156"/>` },
    { id: "lighthouse", name: "Lighthouse", level: "tricky", about: "a striped lighthouse on a rock: a tower that narrows towards the top with two stripes, an arched door and a small window, a gallery ledge, a lantern room with a pointed roof and a ball on top, beams of light to both sides, waves around the rock and two birds",
      steps: ["Draw the tower: tall, and a little narrower at the top than at the bottom.", "Add the ledge, the lantern room and the pointed roof, then the stripes, door and window.", "Add the rock, the waves, the beams of light and the birds."],
      art: `<path d="M82 152 L89 72 H111 L118 152"/><path d="M87 96 H113 M85 124 H115"/><rect x="83" y="62" width="34" height="10" rx="2"/>
        <rect x="90" y="42" width="20" height="20"/><path d="M100 42 V62 M90 52 H110"/><path d="M86 42 L100 26 L114 42 Z"/><circle cx="100" cy="22" r="3"/>
        <path d="M95 152 V140 A5 5 0 0 1 105 140 V152"/><rect x="96" y="104" width="8" height="10" rx="4"/>
        <path d="M36 172 C46 152 68 150 82 152 H118 C138 150 158 156 166 172"/>
        <path d="M16 180 q10 -9 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/>
        <path d="M84 48 L40 36 M84 54 L40 60 M116 48 L160 36 M116 54 L160 60"/>${gull(30, 96)}${gull(150, 90)}` },
    { id: "turtle", name: "Sea Turtle", level: "expert", about: "a sea turtle seen from above, swimming up the page, the same on both sides: an oval shell with a rim and a pattern of plates (two six-sided plates down the middle with plates fanning out to the rim), a rounded head with two eyes, two long front flippers sweeping back, two short back flippers and a small pointed tail",
      steps: ["Lightly draw the big oval shell, then a second oval just inside it for the rim.", "Add the head at the top, the long front flippers, the short back flippers and the tail.", "Draw the two six-sided plates down the middle of the shell, then the lines that fan out from their corners to the rim."],
      art: `<ellipse cx="100" cy="104" rx="44" ry="54"/><ellipse cx="100" cy="104" rx="35" ry="45"/><path d="M100 59 V64 M100 136 V149"/>` +
        both(`<path d="M100 64 L114 73 V90 L100 99 L114 108 V126 L100 136"/><path d="M114 73 L125 68 M114 90 L134 99 L114 108 M114 126 L126 134"/>
        <path d="M110 52 C114 30 100 30 100 30"/>${dot(106, 42, 2.2)}<path d="M136 74 C158 58 176 64 180 84 C164 84 150 90 142 98"/><path d="M130 144 C144 150 152 164 146 174 C136 170 126 162 120 152"/><path d="M104 157 L100 172"/>`) },
    { id: "cottage", name: "Cottage", level: "expert", about: "a small cottage seen from the front: a pointed roof with rows of shingles and a chimney with a curl of smoke, a round attic window, an arched front door with a doorknob, a square four-pane window on each side of the door, a winding path to the door, a round tree on the left and a picket fence on the right",
      steps: ["Draw the house first: a wide box with a big triangle roof that overhangs it on both sides.", "Add the door in the middle, a window on each side, the round attic window and the chimney.", "Add the shingle rows, the path, the tree, the fence and the smoke."],
      art: `<path d="M50 102 V170 H150 V102"/><path d="M40 102 L100 52 L160 102 Z"/><path d="M124 72 V54 H138 V84"/><path d="M131 48 C125 41 137 36 131 27 C128 22 134 18 132 14"/>
        <path d="M90 170 V134 A10 10 0 0 1 110 134 V170"/>${dot(105, 152, 1.8)}
        <rect x="58" y="118" width="22" height="22"/><path d="M69 118 V140 M58 129 H80"/><rect x="120" y="118" width="22" height="22"/><path d="M131 118 V140 M120 129 H142"/><path d="M56 144 H82 M118 144 H144"/>
        <circle cx="100" cy="82" r="8"/><path d="M100 74 V90 M92 82 H108"/>
        <path d="M70 90 q5 5 10 0 M112 96 q5 5 10 0 q5 5 10 0 M60 98 q5 5 10 0 M84 70 q4 4 8 0 M110 70 q4 4 8 0"/>
        <path d="M92 170 C90 180 82 188 74 196 M108 170 C112 180 122 188 134 196"/>
        <path d="M21 170 V140 M29 170 V140"/><path d="M12 138 C2 130 6 114 16 114 C16 102 34 100 38 110 C48 112 48 130 40 136 C36 142 18 142 12 138 Z"/>
        <path d="M4 170 H50 M150 170 H196"/><path d="M158 170 V152 L162 146 L166 152 V170 M172 170 V152 L176 146 L180 152 V170 M186 170 V152 L190 146 L194 152 V170 M152 158 H196"/>` },
    { id: "bicycle", name: "Bicycle", level: "expert", about: "a bicycle seen from the side, facing right: two equal wheels with spokes and hubs, a frame of straight tubes forming two triangles, a saddle on a post, curved handlebars at the front, and a crank with a pedal at the bottom of the frame",
      steps: ["Draw the two wheels first: the same size, level with each other, with a gap about one wheel wide between them.", "Join them with the frame. Find the bottom corner between the wheels, then build the two triangles from it.", "Add the saddle, the handlebars, the crank and pedal, and last of all the spokes."],
      art: `<circle cx="50" cy="128" r="36"/><circle cx="150" cy="128" r="36"/><circle cx="50" cy="128" r="4"/><circle cx="150" cy="128" r="4"/>${spokes(50, 128, 36, 6)}${spokes(150, 128, 36, 6)}
        <path d="M50 128 L92 128 L80 80 M50 128 L83 92 L134 86 L92 128 M132 78 L150 128"/>
        <path d="M68 78 H94 C94 83 78 85 68 78 Z"/><path d="M132 78 L130 66 C130 60 142 58 148 64"/>
        <circle cx="92" cy="128" r="8"/><path d="M92 128 L102 146 M96 146 H108"/><path d="M6 166 H194"/>` },
    { id: "mandala", name: "Mandala", level: "expert", about: "a round mandala pattern centred on the page: a small circle in the middle, a ring of eight short pointed petals around it, a ring of eight longer petals behind those and set between them, a circle around the petals, a ring of sixteen small circles, and an outer circle",
      steps: ["Lightly draw a cross and an X through the middle of your page: eight guide lines to keep everything even.", "Draw the middle circle and the eight short petals, one along each guide line.", "Add the eight long petals in the gaps, then the circles and the ring of sixteen small circles."],
      art: `<circle cx="100" cy="100" r="8"/>${petals(8, 8, 40, 0.36, 0)}${petals(8, 30, 66, 0.3, Math.PI / 8)}<circle cx="100" cy="100" r="70"/>${ringOfDots(16, 79, 4.5)}<circle cx="100" cy="100" r="88"/>` },
    { id: "castle", name: "Castle", level: "expert", about: "a castle seen from the front, the same on both sides: a wall with square battlements and an arched gate with a portcullis grid, a taller tower at each end with a cone roof, a flag and a narrow window, a central keep rising above the wall with battlements, a window and a flag, and a cloud and birds in the sky",
      steps: ["Draw the wall and the ground line, then a tall tower at each end, taller than the wall.", "Add the keep in the middle rising above the wall, the cone roofs and the square battlements.", "Add the arched gate with its grid, the windows, the flags, the bricks, the cloud and the birds."],
      art: both(`<path d="M100 62 H105 V70 H111 V62 H118 V110 H122 V102 H129 V110 H133 V102 H140"/><path d="M140 110 V80 H164 V170"/><path d="M134 80 L152 46 L170 80 Z"/><path d="M152 46 V32"/>
        <rect x="149" y="96" width="6" height="15" rx="3"/><path d="M112 170 V142 A12 12 0 0 0 100 130"/><path d="M106 132 V170"/><path d="M122 128 h9 M126 150 h9 M146 132 h8 M150 152 h8"/>`) +
        `<path d="M10 170 H190 M100 130 V170 M88 148 H112 M88 159 H112"/><rect x="96" y="80" width="8" height="15" rx="4"/><path d="M100 62 V44 L114 49 L100 54"/><path d="M152 32 L164 37 L152 42 M48 32 L60 37 L48 42"/>${cloud(72, 30)}${gull(14, 60)}${gull(172, 16)}` },
    { id: "guitar", name: "Guitar", level: "expert", about: "an acoustic guitar standing upright, the same on both sides: a body with a large rounded lower part, a waist and a smaller upper part, a round sound hole with a ring around it, a bridge near the bottom, a long narrow neck with frets, a headstock with tuning pegs, and four strings running from the bridge to the headstock",
      steps: ["Lightly draw a line down the middle of the page. Draw the body around it: a big round bottom, a waist, and a smaller round top.", "Add the long neck going up from the body, then the headstock and its pegs.", "Add the sound hole and its ring, the bridge, the frets and, last, the strings as straight lines."],
      art: both(`<path d="M100 192 C130 192 146 174 146 154 C146 138 132 130 130 120 C128 110 136 102 136 92 C136 78 122 72 107 72"/><path d="M107 104 V26 L112 22 V6 H100"/><path d="M100 104 H107"/>
        <circle cx="116" cy="10" r="2.5"/><circle cx="116" cy="18" r="2.5"/>`) +
        `<circle cx="100" cy="124" r="11"/><circle cx="100" cy="124" r="15"/><rect x="84" y="158" width="32" height="7" rx="2"/><path d="M93 34 H107 M93 44 H107 M93 54 H107 M93 64 H107 M93 76 H107 M93 90 H107"/>
        <path d="M95.5 158 V14 M98.5 158 V12 M101.5 158 V12 M104.5 158 V14" stroke-width="1.2"/>` },
  ];

  // The picture as SVG text. grid adds light guide squares (a classic trick for copying a picture).
  // size gives the picture a fixed width and height, which is needed to turn it into a photo-like image to send.
  function svg(d, opts) {
    const o = opts || {};
    let grid = "";
    if (o.grid) { let p = ""; for (const v of [50, 100, 150]) p += `M${v} 0 V200 M0 ${v} H200 `; grid = `<path d="${p.trim()}" stroke="#7fb4d8" stroke-width="0.8" fill="none"/>`; }
    const dim = o.size ? ` width="${o.size}" height="${o.size}"` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"${dim} role="img" aria-label="${d.name}"><rect width="200" height="200" fill="#ffffff"/>${grid}` +
      `<g fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${d.art}</g></svg>`;
  }
  const byId = (id) => DRAWINGS.find((d) => d.id === id) || null;

  // A different picture each day, the same for everyone on that day.
  function dayNumber(date) { return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 86400000); }
  function ofTheDay(date) { const n = DRAWINGS.length; return DRAWINGS[((dayNumber(date) % n) + n) % n]; }

  // ---------- the feedback ----------
  // The four things the coach looks at. The worker script uses the same ids (a test checks they match).
  const AREAS = { shapes: "Shapes and proportions", placement: "Size and placement", lines: "Lines", details: "Details" };
  const STAR_WORDS = ["", "Just getting started", "Taking shape", "Good match", "Great match", "Spot on"];

  const text = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
  const stars = (v) => Math.min(5, Math.max(1, Math.round(Number(v)) || 1));
  const list = (v, max) => (Array.isArray(v) ? v : []).map((s) => text(s, 400)).filter(Boolean).slice(0, max);
  // Whatever comes back is tidied into exactly the shape the screen expects, or null if it can't be used.
  function tidyFeedback(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const headline = text(raw.headline, 200);
    if (!headline) return null;
    const seen = {};
    for (const a of Array.isArray(raw.areas) ? raw.areas : []) if (a && AREAS[a.area] && !seen[a.area]) seen[a.area] = { area: a.area, stars: stars(a.stars), note: text(a.note, 400) };
    return { isDrawing: raw.is_drawing !== false, headline, overall: stars(raw.overall), areas: Object.keys(AREAS).filter((k) => seen[k]).map((k) => seen[k]),
      wentWell: list(raw.went_well, 4), tryNext: list(raw.try_next, 4), challenge: text(raw.challenge, 400) };
  }

  // ---------- talking to the worker ----------
  // The worker is a small script on Cloudflare that holds the Claude key, so the key is never on this device.
  function cleanWorkerUrl(v) {
    let s = String(v || "").trim();
    if (!s) return "";
    if (!/^[a-z]+:\/\//i.test(s)) s = "https://" + s;
    let u; try { u = new URL(s); } catch (e) { return ""; }
    if (u.protocol !== "https:" || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.workers\.dev$/i.test(u.hostname)) return "";
    return u.origin + (u.pathname === "/" ? "/" : u.pathname);
  }
  function requestBody(d, referencePng, drawingJpeg) {
    return { drawing: { id: d.id, name: d.name, about: d.about, level: d.level }, reference: referencePng, photo: drawingJpeg };
  }
  const PROBLEMS = {
    not_set_up: "Sketch Match isn't set up on this device yet. Ask a grown-up to open Setup.",
    bad_code: "The family code isn't right. Ask a grown-up to check it in Setup.",
    not_allowed: "The feedback service didn't accept this app. A grown-up needs to check the worker's settings.",
    too_big: "That photo is too big to send. Try taking it again.",
    bad_request: "Something was wrong with what the app sent. Try taking the photo again.",
    busy: "The coach is busy right now. Wait a minute and try again.",
    no_credit: "The Claude account is out of credit. Tell a grown-up.",
    declined: "The coach couldn't look at that photo. Try a photo of just your drawing.",
    service: "The coach had a problem. Try again in a minute.",
    offline: "Couldn't reach the coach. Check the internet connection and try again.",
  };
  const explain = (code) => PROBLEMS[code] || PROBLEMS.service;

  // Shrinks a photo's size to fit inside max x max without changing its shape (never enlarges).
  function fitSize(w, h, max) {
    const k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  // ---------- the sketchbook (past tries, kept on this device) ----------
  const MAX_TRIES = 40;
  function addTry(tries, entry) { return [entry].concat(tries || []).slice(0, MAX_TRIES); }
  function bestStars(tries, drawingId) { let b = 0; for (const t of tries || []) if (t.drawingId === drawingId && t.feedback) b = Math.max(b, t.feedback.overall); return b; }

  // ---------- the weekday time limit ----------
  // Monday to Friday the app can be used for a set number of minutes a day (20 unless a parent changes it).
  // Saturdays and Sundays have no limit, and a parent can add time or lift the limit for the rest of a day.
  // Only the time the app is open on the screen is counted, and the count starts again each day.
  const DEFAULT_LIMIT = { on: true, minutes: 20 };
  const two = (n) => (n < 10 ? "0" : "") + n;
  const dayKey = (d) => d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const count = (v) => Math.max(0, Math.floor(Number(v)) || 0);
  function cleanLimit(limit) {
    const l = limit && typeof limit === "object" ? limit : {};
    return { on: l.on !== false, minutes: Math.min(180, Math.max(5, Math.round(Number(l.minutes)) || DEFAULT_LIMIT.minutes)) };
  }
  // Today's record: seconds used, extra seconds a parent added, and whether a parent lifted the limit for today.
  function todayTime(time, now) {
    const day = dayKey(now);
    return time && time.day === day ? { day, used: count(time.used), extra: count(time.extra), free: time.free === true } : { day, used: 0, extra: 0, free: false };
  }
  function timeStatus(time, limit, now) {
    const l = cleanLimit(limit), t = todayTime(time, now);
    if (!l.on) return { limited: false, why: "off" };
    if (isWeekend(now)) return { limited: false, why: "weekend" };
    if (t.free) return { limited: false, why: "parent" };
    const allowed = l.minutes * 60 + t.extra, left = Math.max(0, allowed - t.used);
    return { limited: true, allowed, left, locked: left <= 0 };
  }
  function addTime(time, now, seconds) { const t = todayTime(time, now); t.used += count(seconds); return t; }
  // A parent allows more: a number of minutes, or "day" for no limit for the rest of today.
  function allowMore(time, now, what) { const t = todayTime(time, now); if (what === "day") t.free = true; else t.extra += count(what) * 60; return t; }
  function clockText(status) {
    if (!status.limited) return status.why === "weekend" ? "Weekend: no time limit" : status.why === "parent" ? "No time limit today" : "";
    if (status.locked) return "Time's up for today";
    return status.left <= 60 ? "Less than a minute left today" : Math.ceil(status.left / 60) + " min left today";
  }
  // The parent PIN is kept scrambled, not as typed. It is a courtesy lock for a family, not strong security.
  const validPin = (pin) => /^\d{4,8}$/.test(String(pin));
  function pinHash(pin) {
    let h = 2166136261;
    for (const ch of "sketch-match:" + String(pin)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    for (let i = 0; i < 1000; i++) h = Math.imul(h ^ (h >>> 13), 2246822519) >>> 0;
    return h.toString(36);
  }

  const api = { DEFAULT_LIMIT, dayKey, isWeekend, cleanLimit, todayTime, timeStatus, addTime, allowMore, clockText, validPin, pinHash, LEVELS, DRAWINGS, AREAS, STAR_WORDS, MAX_TRIES, svg, byId, dayNumber, ofTheDay, tidyFeedback, cleanWorkerUrl, requestBody, explain, PROBLEMS, fitSize, addTry, bestStars };
  root.SketchMatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
