export interface Author {
  slug: string;
  name: string;
  jobTitle: string;
  description: string;
  /** Meta description SEO para el <head> (distinta del bio que se muestra en la página). */
  metaDescription: string;
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
    metaDescription:
      "Federico Sendra, CEO de SpaceDev, escribe en Aura Gold sobre oro digital e inversión frente a la inflación en México. Lee sus artículos.",
    image: "/images/authors/federico-sendra.jpeg",
    sameAs: ["https://www.forbes.com/councils/forbestechcouncil/people/federicosendra/", "https://www.linkedin.com/in/fsendra/"],
  },
  "juan-manuel-sobral": {
    slug: "juan-manuel-sobral",
    name: "Juan Manuel Sobral",
    jobTitle: "Fundador y CTO",
    description:
      "Coding Geek. Emprendedor tecnológico con +11 años de experiencia en desarrollo y una maestría en Blockchain. Fundador y CTO de SpaceDev.",
    metaDescription:
      "Juan Manuel Sobral, CTO de SpaceDev, escribe en Aura Gold sobre oro físico, inflación y ahorro inteligente en México. Descubre sus guías.",
    image: "/images/authors/juan-manuel-sobral.png",
    sameAs: ["https://www.linkedin.com/in/juanmsobral/", "https://x.com/juanmsobral"],
  },
};
