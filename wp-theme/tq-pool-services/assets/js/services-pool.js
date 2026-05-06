// ============================================================
// SERVICES POOL DIAGRAM — interactive hotspots
// Click/tap any dot on the pool SVG to switch the caption panel.
// ============================================================

(function () {
  const CAPTIONS = {
    skimmer: {
      title: 'Skimmer',
      body:  "The mouth on the side of the pool that pulls in floating debris before it sinks. We empty the basket every visit and check the throat for cracks — it's the first thing to fail in a leaf-heavy pool.",
    },
    pump: {
      title: 'Pump',
      body:  'Moves water through the system. We check pressure at the gauge, listen for bearing wear, and confirm it primes properly. A worn pump is the most common cause of pool problems we see.',
    },
    filter: {
      title: 'Filter',
      body:  'Catches the particulates the skimmer misses. We backwash sand filters or hose-out cartridges, monitor the pressure differential, and flag a filter media that needs replacement before water clarity drops.',
    },
    chlorinator: {
      title: 'Chlorinator',
      body:  "Generates chlorine from salt. We test salt levels, inspect the cell for calcium scale, and time the dosing to your pool's actual chlorine demand — not a factory default.",
    },
    return: {
      title: 'Return jet',
      body:  "Sends filtered water back into the pool. We check the angle for proper circulation (badly angled jets create dead spots where algae grows) and clean the eyeball fitting.",
    },
    tiles: {
      title: 'Tiles & coping',
      body:  'The waterline tiles take a beating from sun, splash and chemistry. We scrub the calcium line, check grout, and inspect coping stones around the surrounds for trip hazards.',
    },
    vacuum: {
      title: 'Vacuum & floor',
      body:  "We vacuum the pool floor on every visit, brush the walls, and check the floor for staining or cracks. Our cordless robotic vac handles most pools in under 25 minutes.",
    },
  };

  const ORDER = ['skimmer','pump','filter','chlorinator','return','tiles','vacuum'];
  const NUMBER = Object.fromEntries(ORDER.map((k, i) => [k, i + 1]));

  const root = document.querySelector('.pool-svg');
  const cap  = document.getElementById('poolCaption');
  if (!root || !cap) return;

  const numEl   = cap.querySelector('.pool-caption__num');
  const titleEl = cap.querySelector('.pool-caption__title');
  const bodyEl  = cap.querySelector('.pool-caption__body');

  function activate(key) {
    const meta = CAPTIONS[key];
    if (!meta) return;
    root.querySelectorAll('.pool-hot').forEach(g => {
      g.classList.toggle('is-active', g.dataset.key === key);
    });
    numEl.textContent   = NUMBER[key] ?? '';
    titleEl.textContent = meta.title;
    bodyEl.textContent  = meta.body;
  }

  root.querySelectorAll('.pool-hot').forEach(g => {
    g.addEventListener('click', () => activate(g.dataset.key));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(g.dataset.key);
      }
    });
  });

  // Default selection
  activate('skimmer');
})();
