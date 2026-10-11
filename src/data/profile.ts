// Every fact on the site comes from this file (and codeforces.ts). Sources: Abhay's resume, his
// public GitHub repos, arXiv 2405.06467 / Springer LNCS, and the public Codeforces API.
// Amazon work is described without internal system names, by his choice.

// import.meta.env is undefined when vite.config.ts imports this file at build time.
const BASE: string = import.meta.env?.BASE_URL ?? '/portfolio/';

export type LinkKind = 'mail' | 'phone' | 'linkedin' | 'github' | 'demo' | 'paper' | 'profile' | 'web';
export type Link = { label: string; url: string; kind: LinkKind };

export type PanelId =
  | 'about' | 'contact' | 'skills'
  | 'career' | 'razorpay' | 'limeroad'
  | 'amazon' | 'amazon-rewards' | 'amazon-oncall-agent' | 'amazon-migration' | 'amazon-retention'
  | 'amazon-connectors' | 'amazon-oncall' | 'genai-hackathon'
  | 'projects' | 'project-scan2scope' | 'project-self-driving-car' | 'project-trip-planner'
  | 'project-weather' | 'project-rule-engine' | 'project-tower-defense' | 'project-early'
  | 'project-space-shooters' | 'project-hit-the-ball' | 'project-lightsout' | 'project-covid'
  | 'codeforces' | 'cp-platforms'
  | 'education' | 'school' | 'paper' | 'hackathons' | 'activities'
  | 'sports' | 'gaming' | 'typing' | 'credits';

export type Panel = {
  title: string;
  kicker?: string; // small line above the title
  meta?: string[]; // chips: dates, place, stack
  body?: string[]; // paragraphs
  bullets?: string[];
  groups?: { label: string; items: string[] }[];
  stats?: { label: string; value: string }[];
  links?: Link[];
  image?: { src: string; alt: string };
  related?: PanelId[]; // "next" buttons
};

export const contact = {
  email: 'abhay0611234@gmail.com',
  phoneDisplay: '+91 93193 37883',
  phoneHref: 'tel:+919319337883',
  linkedin: 'https://www.linkedin.com/in/abhay-singh-raihal/',
  github: 'https://github.com/abhayraihal',
  codeforces: 'https://codeforces.com/profile/bubble',
  leetcode: 'https://leetcode.com/u/b20144/',
  codechef: 'https://www.codechef.com/users/abhayraihal',
};

const L = {
  email: { label: contact.email, url: `mailto:${contact.email}`, kind: 'mail' },
  phone: { label: contact.phoneDisplay, url: contact.phoneHref, kind: 'phone' },
  linkedin: { label: 'LinkedIn', url: contact.linkedin, kind: 'linkedin' },
  github: { label: 'GitHub', url: contact.github, kind: 'github' },
  codeforces: { label: 'Codeforces', url: contact.codeforces, kind: 'profile' },
  leetcode: { label: 'LeetCode', url: contact.leetcode, kind: 'profile' },
  codechef: { label: 'CodeChef', url: contact.codechef, kind: 'profile' },
} satisfies Record<string, Link>;

const repo = (name: string): Link => ({ label: 'GitHub', url: `${contact.github}/${name}`, kind: 'github' });
const demo = (url: string): Link => ({ label: 'Live demo', url, kind: 'demo' });

export const profile = {
  name: 'Abhay Singh Raihal',
  firstName: 'Abhay',
  role: 'Software Development Engineer',
  employer: 'Amazon',
  location: 'Bengaluru, India',
  roleLine: 'Software Development Engineer at Amazon, Bengaluru',
  teamLine: 'Payments and rewards points',
  photo: { src: `${BASE}images/abhay.jpg`, alt: 'Abhay in a hat and sunglasses, leaning on a green railing, with a golden domed building behind him' },
  // Shown on the easel in the IIT Mandi zone, where it was taken.
  campusPhoto: { src: `${BASE}images/abhay-iit-mandi.jpg`, alt: 'Abhay standing in front of the IIT Mandi campus, with forested hills behind him' },
  avatar: `${BASE}images/abhay-avatar.jpg`,
  highlights: ['Codeforces Expert, max rating 1719', 'ICPR 2024 co-author', '2000+ problems solved'],
};

export type Job = { panel: PanelId; company: string; role: string; dates: string; place: string; color: string };

// Newest first, as on the resume.
export const jobs: Job[] = [
  { panel: 'amazon', company: 'Amazon', role: 'Software Development Engineer', dates: 'May 2025 – now', place: 'Bengaluru', color: '#ff9900' },
  { panel: 'limeroad', company: 'LimeRoad', role: 'Software Development Engineer', dates: 'Nov 2024 – Apr 2025', place: 'Gurgaon', color: '#e9435d' },
  { panel: 'razorpay', company: 'Razorpay', role: 'SDE Intern, RazorpayX Payouts', dates: 'Jun – Aug 2023', place: 'Bengaluru', color: '#3395ff' },
];

export type Project = { panel: PanelId; title: string; year: number; tagline: string; stack: string[]; image?: string; links: Link[] };

export const projects: Project[] = [
  {
    panel: 'project-scan2scope', title: 'scan2scope', year: 2026,
    tagline: 'Phone scans to dimensioned floor plans, damage and repair scope',
    stack: ['Python', 'PyTorch', 'MapAnything', 'SAM 2.1'],
    image: `${BASE}images/projects/scan2scope.jpg`, links: [repo('scan2scope')],
  },
  {
    panel: 'project-self-driving-car', title: 'Self-driving car', year: 2024,
    tagline: 'Neural-network cars learning to dodge traffic, no libraries',
    stack: ['JavaScript', 'Canvas'],
    image: `${BASE}images/projects/self-driving-car.jpg`,
    links: [repo('self-driving-car'), demo('https://self-driving-car-rose.vercel.app')],
  },
  {
    panel: 'project-trip-planner', title: 'AI trip planner', year: 2024,
    tagline: 'Gemini-generated itineraries with hotels and maps',
    stack: ['React', 'Gemini', 'Firebase'],
    links: [repo('ai-trip-planner-web'), demo('https://ai-trip-planner-web-omega.vercel.app')],
  },
  {
    panel: 'project-weather', title: 'Weather monitor', year: 2024,
    tagline: 'Daily weather rollups and alerts for six Indian metros',
    stack: ['React', 'Firestore', 'OpenWeatherMap'],
    links: [repo('realtime-weather-app'), demo('https://realtime-weather-app-ebon.vercel.app')],
  },
  {
    panel: 'project-rule-engine', title: 'Rule engine with AST', year: 2024,
    tagline: 'Parse, combine and evaluate rules as trees',
    stack: ['Node.js', 'Express', 'React'],
    image: `${BASE}images/projects/rule_engine_with_ast.jpg`, links: [repo('rule_engine_with_ast')],
  },
  {
    panel: 'project-tower-defense', title: 'Tower defense AI', year: 2022,
    tagline: 'Team game where a genetic algorithm places the towers',
    stack: ['Python', 'Pygame', 'NumPy'],
    image: `${BASE}images/projects/Tower_defense_ai1.jpg`, links: [repo('Tower_defense_ai1')],
  },
];

// The 2022 projects, each with its own bay in the projects garage like the featured ones.
export const moreProjects: Project[] = [
  {
    panel: 'project-space-shooters', title: 'Space Shooters', year: 2022,
    tagline: 'Pygame alien shooter with sound effects',
    stack: ['Python', 'Pygame'],
    image: `${BASE}images/projects/Space-Shooters-Game-using-Pygame.jpg`, links: [repo('Space-Shooters-Game-using-Pygame')],
  },
  {
    panel: 'project-hit-the-ball', title: 'Hit the Ball', year: 2022,
    tagline: 'Pygame paddle game with lives and a retry screen',
    stack: ['Python', 'Pygame'],
    image: `${BASE}images/projects/Hit-The-Ball-game-Using-Pygame.jpg`, links: [repo('Hit-The-Ball-game-Using-Pygame')],
  },
  {
    panel: 'project-lightsout', title: 'LightsOut', year: 2022,
    tagline: 'Movie-rating site with reviews, genres and an admin page',
    stack: ['PHP', 'MySQL', 'JavaScript'],
    image: `${BASE}images/projects/LightsOut.jpg`, links: [repo('LightsOut')],
  },
  {
    panel: 'project-covid', title: 'COVID-19 forecasting', year: 2022,
    tagline: 'Autoregression models on 612 days of daily cases',
    stack: ['Python', 'statsmodels', 'pandas'],
    links: [repo('Autoregression-on-Covid-data')],
  },
];

export const allProjects: Project[] = [...projects, ...moreProjects];

// Older one-line form of moreProjects.
export const earlyProjects: { title: string; year: number; line: string; image?: string; link: Link }[] = moreProjects.map((p) => ({
  title: p.title, year: p.year, line: p.tagline, image: p.image, link: p.links[0],
}));

export const sports = ['Football', 'Table tennis', 'Lawn tennis', 'Volleyball', 'Swimming', 'Running', 'Cycling', 'Trekking', 'Bowling'];

export const gaming = {
  games: ['CS:GO', 'Valorant', 'Elden Ring', 'Sekiro: Shadows Die Twice', 'Black Myth: Wukong', 'The Last of Us Part I and II', 'Red Dead Redemption 2'],
  playstation: 'opulentfoxx',
  steam: 'p1xEL',
};

export const typing = { wpm: 110 };

// One brick per skill on the skill wall, as listed on the resume.
export const skillBricks = [
  'C/C++', 'Python', 'Java', 'JavaScript', 'React', 'MySQL', 'HTML', 'Git', 'Bash', 'C#',
  'AWS', 'MCP', 'Agentic AI', 'Generative AI', 'ASP.NET', 'Firebase', 'CI/CD', 'Unity', 'LaTeX',
  'MongoDB', 'Linux', 'IntelliJ', 'Postman',
];

export const coursework = ['DSA', 'OOP', 'Operating systems', 'Databases', 'Deep learning', 'Computer networks', 'Machine learning', 'Data science', 'Software engineering'];

export const paper = {
  title: 'Attend, Distill, Detect: Attention-aware Entropy Distillation for Anomaly Detection',
  short: 'Attend, Distill, Detect',
  venue: 'ICPR 2024 · Springer LNCS, Pattern Recognition, pp. 254–270',
  authors: ['Sushovan Jena', 'Vishwas Saini', 'Ujjwal Shaw', 'Pavitra Jain', 'Abhay Singh Raihal', 'Anoushka Banerjee', 'Sharad Joshi', 'Ananth Ganesh', 'Arnav Bhavsar'],
  result: '+3.92% over the multi-class baseline at the same inference latency',
  arxiv: 'https://arxiv.org/abs/2405.06467',
  doi: 'https://doi.org/10.1007/978-3-031-78169-8_17',
};

export const panels: Record<PanelId, Panel> = {
  about: {
    title: profile.name,
    kicker: profile.roleLine,
    body: [
      "I'm a software engineer at Amazon in Bengaluru, on the team that lets customers pay with rewards points. I write Java and Python on AWS. The work covers payment options, region migrations, data retention and an AI agent that root-causes oncall tickets.",
      'Before Amazon I worked at LimeRoad on lead generation and a logistics integration, and before that I interned on the RazorpayX Payouts team. I studied Data Science and Engineering at IIT Mandi, in the Kamand valley in the Himalayas.',
      "I've done competitive programming since 2021 and I'm an Expert on Codeforces. I play football, table tennis and a handful of other sports, I play a lot of CS:GO, and at IIT Mandi I led rides for the Mountain Biking Club.",
    ],
    image: profile.photo,
    links: [L.email, L.linkedin, L.github],
    related: ['amazon', 'projects', 'contact'],
  },
  contact: {
    title: 'Get in touch',
    kicker: 'Contact',
    links: [L.email, L.phone, L.linkedin, L.github, L.codeforces, L.leetcode, L.codechef],
  },
  skills: {
    title: 'Skills',
    groups: [
      { label: 'Languages', items: ['C/C++', 'Python', 'Java', 'JavaScript', 'C#', 'SQL', 'Bash', 'HTML'] },
      { label: 'Frameworks and platforms', items: ['React', 'Spring', 'Node.js', 'ASP.NET', 'AWS', 'DynamoDB', 'EMR + Spark', 'Bedrock AgentCore', 'Firebase', 'MongoDB', 'MySQL'] },
      { label: 'AI', items: ['Agentic AI', 'MCP', 'Generative AI', 'PyTorch'] },
      { label: 'Tools', items: ['Git', 'Linux (Ubuntu)', 'Windows', 'CI/CD', 'IntelliJ', 'Visual Studio', 'Sublime Text', 'Postman', 'Unity', 'LaTeX'] },
      { label: 'Coursework', items: coursework },
    ],
  },
  career: {
    title: 'Career road',
    kicker: 'Work, oldest first',
    bullets: [
      'Razorpay, SDE Intern on RazorpayX Payouts, Jun – Aug 2023',
      'LimeRoad, Software Development Engineer, Nov 2024 – Apr 2025',
      'Amazon, Software Development Engineer, May 2025 – now',
    ],
    related: ['razorpay', 'limeroad', 'amazon'],
  },
  razorpay: {
    title: 'Razorpay',
    kicker: 'SDE Intern · RazorpayX Payouts team · Bengaluru',
    meta: ['Jun – Aug 2023', 'Java', 'Spring'],
    bullets: [
      'Designed and deployed production admin actions for payouts.',
      'Mapped and documented the code flow of the payout-creation route.',
      'Improved data retrieval speed by 90% with Redis GET, SET and queue operations.',
      'Added authorization checks.',
    ],
    links: [{ label: 'Internship presentation', url: 'https://docs.google.com/presentation/d/1GpOuLDsZ-TS8Y4MWV4hUGKbLv6WNGpls/edit?usp=sharing', kind: 'web' }],
    related: ['limeroad', 'amazon'],
  },
  limeroad: {
    title: 'LimeRoad',
    kicker: 'Software Development Engineer · Gurgaon',
    meta: ['Nov 2024 – Apr 2025', 'Java', 'MySQL', 'MongoDB'],
    bullets: [
      'Reworked edge-case handling in mcout, the lead-generation system for shoppers who abandon their cart or checkout, so more of its errors were caught and resolved.',
      'Integrated Blue Dart as a logistics partner: APIs for waybill creation, cancellation and status tracking, with both push and pull updates.',
    ],
    links: [{ label: 'limeroad.com', url: 'https://www.limeroad.com/', kind: 'web' }],
    related: ['amazon', 'razorpay'],
  },
  amazon: {
    title: 'Amazon',
    kicker: 'Software Development Engineer · Bengaluru',
    meta: ['May 2025 – now', 'Java', 'Python', 'AWS', 'CI/CD'],
    body: ['I work on the team behind paying with rewards points on Amazon. Each of the six exhibits on the Amazon plaza is one piece of that work.'],
    bullets: [
      'Rewards points as a payment option for Prime Video in Japan, the US and Brazil.',
      'An AI oncall agent that saves about 30 minutes of log-digging per ticket.',
      'A region migration that moved traffic for Spain, France, the UK and Italy with no customer impact.',
      'A 29-day retention limit and a 21M-row purge that cut stored data by 96%.',
      'A partner connector migration with no playbook, and the SOP the team now follows.',
      'Production oncall, including Black Friday / Cyber Monday, New Year and Prime Day, with 30+ high-severity tickets resolved.',
    ],
    related: ['amazon-rewards', 'amazon-oncall-agent', 'amazon-migration', 'amazon-retention', 'amazon-connectors', 'amazon-oncall'],
  },
  'amazon-rewards': {
    title: 'Rewards points for Prime Video',
    kicker: 'Amazon · payments',
    bullets: [
      'Built rewards-points accounts from non-bank partners as a payment option for Prime Video rentals and purchases in Japan, the US and Brazil.',
      'Wrote 2 low-level designs covering the payment preference page and the buy-box widget.',
      'Completed the widget changes and the accounting work, and verified the flow end to end in Japan.',
    ],
    related: ['amazon-oncall-agent', 'amazon'],
  },
  'amazon-oncall-agent': {
    title: 'AI oncall agent',
    kicker: 'Amazon · developer tooling',
    bullets: [
      'Built an event-driven Claude agent on Amazon Bedrock AgentCore that picks up every new oncall ticket.',
      'It uses MCP tools and retrieval over logs, metrics, code and runbooks to find the root cause.',
      'It posts a report with its confidence and evidence, which saves about 30 minutes of manual log-digging per ticket.',
    ],
    meta: ['Claude', 'Bedrock AgentCore', 'MCP', 'RAG'],
    related: ['amazon-migration', 'amazon'],
  },
  'amazon-migration': {
    title: 'Region migration',
    kicker: 'Amazon · infrastructure',
    bullets: [
      'Moved a rewards service from Dublin to two other EU AWS regions, replicating its infrastructure, alarms and endpoints.',
      'Ramped traffic to 100% across Spain, France, the UK and Italy through shadow testing and DNS shifts, with no customer impact.',
      'Scaled the Dublin fleet down to zero hosts.',
    ],
    related: ['amazon-retention', 'amazon'],
  },
  'amazon-retention': {
    title: '29-day data retention',
    kicker: 'Amazon · data protection',
    bullets: [
      'Cut the retention of customer IDs in a DynamoDB enrollment table to 29 days with TTL.',
      'Purged 21M existing rows across 6 AWS accounts and 3 environments with an EMR + Spark job.',
      'Met 8 data-retention obligations without a 4–6 week onboarding to a separate deletion platform, and cut stored data by 96%.',
    ],
    meta: ['DynamoDB TTL', 'EMR', 'Spark'],
    related: ['amazon-connectors', 'amazon'],
  },
  'amazon-connectors': {
    title: 'Partner connector migration',
    kicker: 'Amazon · integrations',
    bullets: [
      "Migrated all 4 of a rewards partner's message connectors to another internal platform, with no existing playbook.",
      'Worked out the connector model and the external resource setup from scratch.',
      'Took all 4 to 100% through a staged A/B dial-up with no customer impact, and wrote the SOP the team now uses for these migrations.',
    ],
    related: ['amazon-oncall', 'amazon'],
  },
  'amazon-oncall': {
    title: 'Oncall at peak',
    kicker: 'Amazon · operations',
    bullets: [
      'Production oncall through Black Friday / Cyber Monday, New Year and Prime Day.',
      'Resolved 30+ high-severity tickets on day and night pages before they turned into customer impact or lost revenue.',
    ],
    related: ['amazon-rewards', 'amazon'],
  },
  'genai-hackathon': {
    title: 'Amazon Payments GenAI Hackathon',
    kicker: 'Award',
    body: ['Won the most innovative idea award with my team.'],
    related: ['hackathons', 'amazon'],
  },
  projects: {
    title: 'Projects',
    kicker: 'Public work on GitHub',
    bullets: allProjects.map((p) => `${p.title} (${p.year}): ${p.tagline}`),
    links: [L.github],
    related: allProjects.map((p) => p.panel),
  },
  'project-scan2scope': {
    title: 'scan2scope',
    kicker: '2026 · Python',
    body: ['Turns iPhone photos, a walkthrough video or a LiDAR scan of a home into a dimensioned floor plan, damage regions on walls, floors and ceilings, and repair-scope line items, with a 90% interval on every measurement.'],
    bullets: [
      "Geometry comes from Meta's MapAnything model (photos and video) or the LiDAR depth; damage from Grounding DINO boxes and SAM 2.1 masks.",
      '11 rules flag likely concealed damage, for example a crack within 0.3 m of a door or window corner.',
      'In a real bedroom, 8 of 8 photo-tier wall lengths came within 8% of tape measurements.',
      'A 215 s LiDAR recording came out as 7 rooms linked by 7 doorways.',
      'Built in about 30 hours for an applied-AI case study, directing Claude Code agents.',
    ],
    meta: ['Python', 'PyTorch', 'MapAnything', 'Grounding DINO', 'SAM 2.1', 'OpenCV'],
    image: { src: `${BASE}images/projects/scan2scope.jpg`, alt: 'Floor plan generated by scan2scope from a LiDAR recording: seven rooms with wall lengths' },
    links: [repo('scan2scope')],
    related: ['project-self-driving-car', 'projects'],
  },
  'project-self-driving-car': {
    title: 'Self-driving car',
    kicker: '2024 · JavaScript',
    body: ['A browser simulation with no libraries: 100 cars drive a three-lane road at once, each steered by a small neural network that reads 5 ray sensors.'],
    bullets: [
      'The network, ray casting and polygon collision are plain JavaScript on two canvases.',
      'The car that gets furthest can be saved to localStorage; the next run starts from it plus mutated copies.',
      "Switching the control type in main.js gives a manual mode with the arrow keys, and the second canvas draws the leading car's network as it drives.",
    ],
    meta: ['JavaScript', 'Canvas', 'localStorage'],
    image: { src: `${BASE}images/projects/self-driving-car.jpg`, alt: 'Self-driving car simulation: cars on a three-lane road with sensor rays, and the network drawn beside it' },
    links: [repo('self-driving-car'), demo('https://self-driving-car-rose.vercel.app')],
    related: ['project-trip-planner', 'projects'],
  },
  'project-trip-planner': {
    title: 'AI trip planner',
    kicker: '2024 · React',
    body: ['Pick a destination, a trip length, a budget and a group size, and Gemini returns hotel options and a day-by-day plan.'],
    bullets: [
      'Gemini 1.5 Flash runs in JSON mode; trips are saved to Firestore behind Google sign-in.',
      'Destination search runs over a bundled list of 44,383 cities, and each card has Pixabay photos and a Google Maps link.',
      'The landing page has an animated 3D avatar rendered with React Three Fiber.',
      'It was built on Gemini 1.5 Flash, which Google has since retired, so trip generation on the demo may no longer work.',
    ],
    meta: ['React', 'Gemini', 'Firebase', 'Tailwind', 'shadcn/ui', 'Vercel'],
    links: [repo('ai-trip-planner-web'), demo('https://ai-trip-planner-web-omega.vercel.app')],
    related: ['project-weather', 'projects'],
  },
  'project-weather': {
    title: 'Weather monitor',
    kicker: '2024 · React',
    body: ['Polls OpenWeatherMap every 5 minutes for Delhi, Mumbai, Chennai, Bangalore, Kolkata and Hyderabad, and keeps one running daily summary per city in Firestore.'],
    bullets: [
      'Each summary keeps sums, counts, the minimum, the maximum and a count per condition, so averages and the dominant condition come out without storing raw readings.',
      'Email alerts fire after 3 consecutive readings breach a threshold such as 35°C (sending is mocked).',
    ],
    meta: ['React', 'Firestore', 'OpenWeatherMap', 'zod'],
    links: [repo('realtime-weather-app'), demo('https://realtime-weather-app-ebon.vercel.app')],
    related: ['project-rule-engine', 'projects'],
  },
  'project-rule-engine': {
    title: 'Rule engine with AST',
    kicker: '2024 · Node.js',
    body: ["Turns rule strings like age > 30 AND department = 'Sales' into an abstract syntax tree, combines several rules into one tree and evaluates it against JSON data."],
    bullets: [
      'The Express server parses rules with jsep and simplifies them to operator nodes and comparison leaves.',
      'A React client creates, combines and evaluates rules and shows each tree as JSON.',
    ],
    meta: ['Node.js', 'Express', 'jsep', 'React'],
    image: { src: `${BASE}images/projects/rule_engine_with_ast.jpg`, alt: 'Hand-drawn sketch of a rule as an abstract syntax tree' },
    links: [repo('rule_engine_with_ast')],
    related: ['project-tower-defense', 'projects'],
  },
  'project-tower-defense': {
    title: 'Tower defense AI',
    kicker: '2022 · Python · team of 7',
    body: ['A Pygame tower defense game with an AI mode, where a genetic algorithm chooses which of six tower types to build on each of 65 map slots.'],
    bullets: [
      'The algorithm evolves 96 layouts over 100 generations, and the average score rises from about 3,200 to 6,252.',
      'My part was early tower and enemy classes: the archer tower, the cannon, and the ghost and mosquito enemies.',
    ],
    meta: ['Python', 'Pygame', 'NumPy'],
    image: { src: `${BASE}images/projects/Tower_defense_ai1.jpg`, alt: 'Tower defense game screenshot with towers along a path' },
    links: [repo('Tower_defense_ai1')],
    related: ['project-space-shooters', 'projects'],
  },
  'project-early': {
    title: 'Early projects',
    kicker: '2022',
    bullets: earlyProjects.map((p) => `${p.title}: ${p.line}`),
    links: earlyProjects.map((p) => ({ ...p.link, label: p.title })),
    related: ['projects'],
  },
  'project-space-shooters': {
    title: 'Space Shooters',
    kicker: '2022 · Python',
    body: ["A Pygame shooter: the player's ship fires at six aliens that sweep sideways and drop a row each time they reach the edge."],
    bullets: [
      'A hit is a bullet within 27 px of an alien.',
      'Laser, explosion and background sounds.',
      "The game ends when an alien gets down to the ship's level.",
    ],
    meta: ['Python', 'Pygame'],
    image: { src: `${BASE}images/projects/Space-Shooters-Game-using-Pygame.jpg`, alt: 'Space Shooters game screenshot: a ship at the bottom firing at aliens' },
    links: [repo('Space-Shooters-Game-using-Pygame')],
    related: ['project-hit-the-ball', 'projects'],
  },
  'project-hit-the-ball': {
    title: 'Hit the Ball',
    kicker: '2022 · Python',
    body: ['A Pygame paddle game: the ball bounces off the walls, every paddle hit scores a point, and a missed ball costs one of five lives.'],
    bullets: ['After the last life, a Game Over screen and a retry button restart the round.'],
    meta: ['Python', 'Pygame'],
    image: { src: `${BASE}images/projects/Hit-The-Ball-game-Using-Pygame.jpg`, alt: 'Hit the Ball game screenshot: a paddle, a ball and the score' },
    links: [repo('Hit-The-Ball-game-Using-Pygame')],
    related: ['project-lightsout', 'projects'],
  },
  'project-lightsout': {
    title: 'LightsOut',
    kicker: '2022 · PHP',
    body: ["A PHP and MySQL movie-rating site: users register, rate films from 1 to 5 with a written review, and see each film's average rating."],
    bullets: [
      'Films can be browsed on five genre pages or searched by title and plot text.',
      'Admin accounts get an Add Movie page.',
      'The SQL script creates the movies, reviews and users tables and seeds 31 films.',
    ],
    meta: ['PHP', 'MySQL', 'JavaScript', 'Bootstrap', 'XAMPP'],
    image: { src: `${BASE}images/projects/LightsOut.jpg`, alt: 'LightsOut logo: a film reel on black' },
    links: [repo('LightsOut')],
    related: ['project-covid', 'projects'],
  },
  'project-covid': {
    title: 'COVID-19 forecasting',
    kicker: '2022 · Python',
    body: ['Autoregression models fitted to 612 days of daily new COVID-19 cases from 30 January 2020, trained on the first 65% of days and tested on the last 35%.'],
    bullets: [
      'One script picks the lag as the last one whose autocorrelation stays above 2/sqrt(N).',
      'Another compares RMSE% and MAPE% for lags of 1, 5, 10, 15 and 25 days.',
    ],
    meta: ['Python', 'statsmodels', 'pandas', 'NumPy', 'matplotlib'],
    links: [repo('Autoregression-on-Covid-data')],
    related: ['project-space-shooters', 'projects'],
  },
  codeforces: {
    title: 'Competitive programming',
    kicker: 'Codeforces · Expert',
    stats: [
      { label: 'Max rating', value: '1719' },
      { label: 'Rated contests', value: '84' },
      { label: 'Solved on Codeforces', value: '952' },
      { label: 'First contest', value: 'Feb 2021' },
    ],
    body: ['The ridge road is my Codeforces rating, one contest every 1.5 m, from 362 in February 2021 to 1719 in January 2025.'],
    bullets: [
      'Pupil in December 2021, Specialist in July 2022, Expert in August 2024.',
      'Most-solved tags: greedy, math, implementation, constructive algorithms, brute force and dp.',
    ],
    links: [L.codeforces],
    related: ['cp-platforms'],
  },
  'cp-platforms': {
    title: 'Other platforms',
    kicker: 'Competitive programming',
    bullets: [
      'LeetCode (b20144): 309 solved (41 easy, 181 medium, 87 hard).',
      'CodeChef (abhayraihal): 4 star, highest rating 1985.',
      'Across all platforms: 2000+ problems solved.',
    ],
    links: [L.leetcode, L.codechef],
    related: ['codeforces'],
  },
  education: {
    title: 'IIT Mandi',
    kicker: 'B.Tech, Data Science and Engineering',
    meta: ['2020 – 2024', 'CGPA 8.13', 'Kamand, Himachal Pradesh'],
    groups: [{ label: 'Coursework', items: coursework }],
    related: ['paper', 'hackathons', 'activities', 'school'],
  },
  school: {
    title: 'Kendriya Vidyalaya Pitampura',
    kicker: 'School · Delhi',
    stats: [
      { label: 'CBSE Class 12 (2020)', value: '95.20%' },
      { label: 'CBSE Class 10 (2018)', value: '89.40%' },
    ],
    related: ['education'],
  },
  paper: {
    title: paper.short,
    kicker: 'ICPR 2024 · co-author',
    body: ['A distributed convolutional attention module (DCAM), used only during training, improves multi-class anomaly detection by 3.92% over the baseline at the same inference latency.'],
    bullets: [
      'Published in the proceedings of the International Conference on Pattern Recognition (ICPR 2024), Springer Lecture Notes in Computer Science, pp. 254–270.',
      `Authors: ${paper.authors.join(', ')}.`,
    ],
    links: [
      { label: 'arXiv 2405.06467', url: paper.arxiv, kind: 'paper' },
      { label: 'Springer', url: paper.doi, kind: 'paper' },
    ],
    related: ['hackathons', 'education'],
  },
  hackathons: {
    title: 'Hackathons',
    kicker: 'Awards',
    bullets: [
      '1st place overall, AI Innovation 3.0 Hackathon, IIT Mandi. I guided the team.',
      '2nd place overall, Frosthack 2022, a national hackathon at IIT Mandi. I led the team.',
      'Most innovative idea, Amazon Payments GenAI Hackathon, with my team.',
    ],
    related: ['paper', 'activities'],
  },
  activities: {
    title: 'Around campus',
    kicker: 'IIT Mandi',
    bullets: [
      'Led rides for the Mountain Biking Club (MTB) at IIT Mandi.',
      'Led a Design Practicum project building assistive wearable tech to help visually impaired people get around.',
      'Ran community surveys for an Interactive Socio-Technical Practicum (ISTP) project, collecting and analysing data on local problems.',
    ],
    related: ['education'],
  },
  sports: {
    title: 'Sports',
    kicker: 'Off the keyboard',
    body: ['I play football whenever there is a game, and I picked up table tennis when I joined college.'],
    groups: [{ label: 'Sports I play', items: sports }],
    related: ['gaming', 'typing'],
  },
  gaming: {
    title: 'Gaming',
    kicker: 'PlayStation and PC',
    body: ['I play a lot of CS:GO.'],
    groups: [{ label: 'Games', items: gaming.games }],
    stats: [
      { label: 'PlayStation', value: gaming.playstation },
      { label: 'Steam', value: gaming.steam },
    ],
    related: ['sports', 'typing'],
  },
  typing: {
    title: 'Touch typing',
    kicker: 'Keyboard',
    body: [`I touch type, with a best speed of ${typing.wpm} words per minute.`],
    stats: [{ label: 'Best speed', value: `${typing.wpm} WPM` }],
    related: ['sports', 'gaming'],
  },
  credits: {
    title: 'About this site',
    kicker: 'Credits',
    body: [
      'Built with React Three Fiber, drei, Rapier physics and zustand on Vite, and hosted on GitHub Pages.',
      "3D models are from Kenney's CC0 kits. Fonts are Lilita One and Rubik (SIL Open Font License).",
    ],
    links: [{ label: 'Source on GitHub', url: `${contact.github}/portfolio`, kind: 'github' }],
  },
};
