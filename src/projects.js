export const PROJECTS = [
  {
    slug: 'brackethub',
    title: 'BracketHub',
    href: 'https://brackethub.club',
    img: '/projects/brackethub.png',
    desc: 'Bringing march-madness style tournament grouping, picking, and scoring to any custom tournament. Compete with friends, join public brackets, all for free. Built with React & Firebase.',
    altText: 'BracketHub tournament bracket interface showing custom tournament creation and competition features',
  },
  {
    slug: 'citi-defense',
    title: 'Citi-Defense',
    href: 'https://github.com/DannyOppenheimer/citi-defense',
    video: '/projects/citi-defense.mp4',
    desc: 'A classic & fun tower defense game built and shipped on a floppy disk for Macintosh Plus 1MB. Defend the Eastern United States from waves of monsters attacking your favorite destinations. Email oppenheimerd1@gmail.com to purchase a floppy disk (I can ship globally!). Built in C with Retro86.',
    altText: 'Citi-Defense gameplay on a classic Macintosh Plus',
  },
  {
    slug: 'bide',
    title: 'Bide',
    href: 'https://trybide.app',
    images: [
      {
        src: '/projects/bide-solo.png',
        alt: 'Bide app showing an active meetup session and solo trip planning',
      },
      {
        src: '/projects/bide-imessage.png',
        alt: 'Bide app creating a meetup directly inside an iMessage conversation',
      },
    ],
    desc: 'Have you ever agreed to pick up a friend from the airport, not been able to figure out a flight tracker, and ended up circling the arrivals loop for 20 minutes as you wait for their delayed plane to land? Use Bide: the app that makes meeting up as easy as possible. Share planned trips and outings with groups built directly into iMessage to make sure everyone gets there, without wasting a second of time. Built in Swift with PostgreSQL.',
  },
  {
    slug: 'drawtex',
    title: 'Drawtex',
    href: 'https://github.com/DannyOppenheimer/Drawtex',
    img: '/projects/drawtex.png',
    desc: 'A Machine-Learning backed note taking app that quickly and easily converts drawn diagrams into Latex. Built with Python, PyTorch, scikit-learn, and more.',
    altText: 'Drawtex interface demonstrating hand-drawn diagram recognition and LaTeX conversion',
  },
  {
    slug: 'spyfall',
    title: 'Spyfall',
    href: 'https://spyfall.dannyoppenheimer.com/',
    img: '/projects/spyfall.png',
    desc: 'A minimalist online version of the popular social deduction game of Spyfall, built with JS.',
    altText: 'Spyfall online game interface showing location-based social deduction gameplay',
  },
  {
    slug: 'senior-map',
    title: 'Senior Map',
    href: 'https://apc-mhs.com/seniormap/',
    img: '/projects/seniormap.png',
    desc: 'Contributed to a long-running high school project tracking post-grad plans. Updated and integrated new Google Maps API features.',
    altText: 'Senior Map showing interactive college and career planning tracker with Google Maps integration',
  },
]

export const PROJECT_SLUGS = PROJECTS.map(project => project.slug)
export const DEFAULT_PROJECT_SLUG = PROJECTS[0].slug
