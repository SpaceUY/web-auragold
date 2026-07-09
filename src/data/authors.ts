export interface Author {
  slug: string;
  name: string;
  jobTitle: string;
  description: string;
  image: string;
  sameAs: string[];
}

export const authors: Record<string, Author> = {
  "federico-sendra": {
    slug: "federico-sendra",
    name: "Federico Sendra",
    jobTitle: "Fundador y CEO",
    description:
      "Emprendedor, tech strategist, padre y eterno aprendiz. Pasé de programar a construir startups: transformo la complejidad en claridad. Fundador y CEO de SpaceDev.",
    image: "/images/authors/federico-sendra.jpeg",
    sameAs: ["https://www.forbes.com/councils/forbestechcouncil/people/federicosendra/", "https://www.linkedin.com/in/fsendra/"],
  },
  "juan-manuel-sobral": {
    slug: "juan-manuel-sobral",
    name: "Juan Manuel Sobral",
    jobTitle: "Fundador y CTO",
    description:
      "Coding Geek. Emprendedor tecnológico con +11 años de experiencia en desarrollo y una maestría en Blockchain. Fundador y CTO de SpaceDev.",
    image: "/images/authors/juan-manuel-sobral.png",
    sameAs: ["https://www.linkedin.com/in/juanmsobral/", "https://x.com/juanmsobral"],
  },
};
