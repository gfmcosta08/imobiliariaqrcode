import { casa63Parser } from "./casa63";
import { genericaBrParser } from "./generica-br";
import { gestorImobParser } from "./gestor-imob";
import { imobiliariasonharParser } from "./imobiliariasonhar";
import { imperioNegociosParser } from "./imperionegociosimob";
import { imoviewParser } from "./imoview";
import { kenloParser } from "./kenlo";
import { logosToParser } from "./logos-to";
import { olxParser } from "./olx";
import { vivanciparser } from "./vivanci";
import { zapImoveisParser } from "./zapimoveis";
import type { SiteParser } from "../types";

/**
 * All registered site-specific parsers.
 * Order matters: more specific parsers should come before generic ones.
 * The detect.ts module iterates this array and returns the first match.
 */
export const ALL_PARSERS: SiteParser[] = [
  // Site-specific (most precise — known CMS/structure)
  imobiliariasonharParser, // Kenlo CMS (seletores confirmados por inspeção)
  vivanciparser,           // Arbo platform (CDN confirmado por inspeção)
  logosToParser,
  casa63Parser,
  imperioNegociosParser,
  olxParser,
  zapImoveisParser,
  imoviewParser,
  gestorImobParser,
  // Kenlo CMS para demais sites da lista (ritacampos, estiloimo, etc.)
  kenloParser,
  // Generic fallback for the remaining small imobiliárias
  genericaBrParser,
];
