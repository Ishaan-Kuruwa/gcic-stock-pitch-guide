/**
 * Stock Matchmaker data: the interests students pick from and the companies
 * they can be matched with. Ported from the GHIC kickoff page.
 *
 * These are starting points for research, not investment advice.
 */

export const interests = [
  { id: 'games', label: 'Video games' },
  { id: 'shoes', label: 'Sneakers and sportswear' },
  { id: 'stream', label: 'Streaming and music' },
  { id: 'food', label: 'Fast food and coffee' },
  { id: 'tech', label: 'Phones and laptops' },
  { id: 'ai', label: 'AI and chips' },
  { id: 'social', label: 'Social media' },
  { id: 'live', label: 'Sports and concerts' },
  { id: 'shop', label: 'Shopping' },
  { id: 'cars', label: 'Cars and rides' },
  { id: 'beauty', label: 'Beauty and skincare' },
  { id: 'health', label: 'Health and medicine' },
] as const;

export type InterestId = (typeof interests)[number]['id'];

/** "giant" = household name, "riser" = up-and-comer. */
export type CompanyStyle = 'giant' | 'riser';

/** The style filter: one style, or both. */
export type StyleChoice = CompanyStyle | 'both';

export const styleChoices: readonly { id: StyleChoice; label: string }[] = [
  { id: 'both', label: 'Show me both' },
  { id: 'giant', label: 'Household names' },
  { id: 'riser', label: 'Up-and-comers' },
];

export const styleLabels: Record<CompanyStyle, string> = {
  giant: 'household name',
  riser: 'up-and-comer',
};

export interface Company {
  ticker: string;
  name: string;
  interest: InterestId;
  style: CompanyStyle;
  /** A question to start the student's research. */
  question: string;
}

export const companies: readonly Company[] = [
  { ticker: 'RBLX', name: 'Roblox', interest: 'games', style: 'riser', question: 'Can Roblox turn its huge young audience into steady profits?' },
  { ticker: 'TTWO', name: 'Take-Two Interactive', interest: 'games', style: 'giant', question: 'How much of Take-Two’s future rides on one blockbuster game?' },
  { ticker: 'SONY', name: 'Sony Group', interest: 'games', style: 'giant', question: 'How do PlayStation, movies, music, and camera sensors fit in one company?' },
  { ticker: 'NKE', name: 'Nike', interest: 'shoes', style: 'giant', question: 'How does Nike compete with newer running brands?' },
  { ticker: 'LULU', name: 'lululemon', interest: 'shoes', style: 'giant', question: 'Can lululemon grow beyond the products it’s known for?' },
  { ticker: 'DECK', name: 'Deckers (HOKA, UGG)', interest: 'shoes', style: 'riser', question: 'Can HOKA keep growing as running shoes get crowded?' },
  { ticker: 'ONON', name: 'On Holding', interest: 'shoes', style: 'riser', question: 'What makes On different enough to keep winning customers?' },
  { ticker: 'NFLX', name: 'Netflix', interest: 'stream', style: 'giant', question: 'How does Netflix keep growing when so many people already subscribe?' },
  { ticker: 'DIS', name: 'Disney', interest: 'stream', style: 'giant', question: 'How do Disney’s parks, movies, and streaming feed each other?' },
  { ticker: 'SPOT', name: 'Spotify', interest: 'stream', style: 'riser', question: 'Can Spotify earn more per listener without losing them?' },
  { ticker: 'MCD', name: 'McDonald’s', interest: 'food', style: 'giant', question: 'Is McDonald’s really a burger business or a real estate business?' },
  { ticker: 'SBUX', name: 'Starbucks', interest: 'food', style: 'giant', question: 'What keeps people paying Starbucks prices for coffee?' },
  { ticker: 'CMG', name: 'Chipotle', interest: 'food', style: 'giant', question: 'How many more Chipotles can open before growth slows?' },
  { ticker: 'CAVA', name: 'Cava', interest: 'food', style: 'riser', question: 'Can Cava open hundreds more restaurants and stay popular?' },
  { ticker: 'AAPL', name: 'Apple', interest: 'tech', style: 'giant', question: 'Beyond the iPhone, where does Apple’s next growth come from?' },
  { ticker: 'GOOGL', name: 'Alphabet (Google)', interest: 'tech', style: 'giant', question: 'How does Google defend search as people ask AI chatbots instead?' },
  { ticker: 'MSFT', name: 'Microsoft', interest: 'tech', style: 'giant', question: 'Which part of Microsoft makes the most money, and is it growing?' },
  { ticker: 'NVDA', name: 'Nvidia', interest: 'ai', style: 'giant', question: 'How long can Nvidia keep its lead in AI chips?' },
  { ticker: 'TSM', name: 'TSMC', interest: 'ai', style: 'giant', question: 'What does it mean to manufacture chips for almost everyone else?' },
  { ticker: 'AMD', name: 'AMD', interest: 'ai', style: 'riser', question: 'Can AMD win a bigger share of the AI chip market?' },
  { ticker: 'META', name: 'Meta Platforms', interest: 'social', style: 'giant', question: 'How does Meta make so much money from apps that are free?' },
  { ticker: 'RDDT', name: 'Reddit', interest: 'social', style: 'riser', question: 'Can Reddit grow ad revenue without upsetting its communities?' },
  { ticker: 'PINS', name: 'Pinterest', interest: 'social', style: 'riser', question: 'Can Pinterest turn inspiration into shopping?' },
  { ticker: 'LYV', name: 'Live Nation', interest: 'live', style: 'giant', question: 'How does Live Nation make money from concerts and tickets?' },
  { ticker: 'DKS', name: 'Dick’s Sporting Goods', interest: 'live', style: 'giant', question: 'Why do people still buy sports gear in stores?' },
  { ticker: 'AMZN', name: 'Amazon', interest: 'shop', style: 'giant', question: 'Is Amazon’s real money in shopping or in cloud computing?' },
  { ticker: 'COST', name: 'Costco', interest: 'shop', style: 'giant', question: 'Why do members pay a yearly fee just to shop at Costco?' },
  { ticker: 'WMT', name: 'Walmart', interest: 'shop', style: 'giant', question: 'How is Walmart competing with Amazon online?' },
  { ticker: 'ETSY', name: 'Etsy', interest: 'shop', style: 'riser', question: 'Can Etsy stand out against giant online marketplaces?' },
  { ticker: 'TSLA', name: 'Tesla', interest: 'cars', style: 'giant', question: 'Should Tesla be valued as a car company or something else?' },
  { ticker: 'UBER', name: 'Uber', interest: 'cars', style: 'giant', question: 'What happens to Uber if self-driving cars take off?' },
  { ticker: 'RIVN', name: 'Rivian', interest: 'cars', style: 'riser', question: 'Can Rivian build electric vehicles at a profit?' },
  { ticker: 'ULTA', name: 'Ulta Beauty', interest: 'beauty', style: 'giant', question: 'Why do beauty brands want to be on Ulta’s shelves?' },
  { ticker: 'ELF', name: 'e.l.f. Beauty', interest: 'beauty', style: 'riser', question: 'How does e.l.f. compete with pricier makeup brands?' },
  { ticker: 'LLY', name: 'Eli Lilly', interest: 'health', style: 'giant', question: 'How big could weight-loss drugs get for Lilly?' },
  { ticker: 'HIMS', name: 'Hims & Hers', interest: 'health', style: 'riser', question: 'Can an online health brand build lasting trust?' },
];
