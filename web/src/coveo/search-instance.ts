"use client";

import {
  buildFacet,
  buildResultList,
  buildSearchBox,
  buildSearchEngine,
  type Facet,
  type ResultList,
  type SearchBox,
  type SearchEngine,
} from "@coveo/headless";

let engine: SearchEngine | null = null;

type SearchControllers = {
  searchBox: SearchBox;
  resultList: ResultList;
  typeFacet: Facet;
  generationFacet: Facet;
  abilityFacet: Facet;
};

let controllers: SearchControllers | null = null;

export function getSearchEngine(): SearchEngine {
  if (!engine) {
    engine = buildSearchEngine({
      configuration: {
        organizationId: process.env.NEXT_PUBLIC_COVEO_ORG_ID ?? "",
        accessToken: process.env.NEXT_PUBLIC_COVEO_API_KEY ?? "",
        search: {
          // Coveo Search hub: analytics + query-pipeline routing label (not your Web source name).
          // If the API key *enforces* a hub, this must match that value (e.g. AdminConsole).
          // If the key leaves Search hub unset, pick a stable app-specific string (see `.env.example`).
          searchHub:
            process.env.NEXT_PUBLIC_COVEO_SEARCH_HUB ?? "PokemonSearch",
        },
      },
    });
  }
  return engine;
}

export function getSearchControllers(): SearchControllers {
  if (!controllers) {
    const e = getSearchEngine();
    controllers = {
      searchBox: buildSearchBox(e),
      resultList: buildResultList(e, {
        options: {
          // Custom fields are not part of the default search hit payload; without this,
          // result.raw omits e.g. pictureuri even when populated (Content Browser still shows them).
          fieldsToInclude: [
            "pictureuri",
            "syspictureuri",
            "pokemontype",
            "pokemongeneration",
            "pokemonability",
            "picture_uri",
            "pokemon_generation",
          ],
        },
      }),
      typeFacet: buildFacet(e, {
        options: { field: "pokemontype", numberOfValues: 25 },
      }),
      generationFacet: buildFacet(e, {
        options: { field: "pokemongeneration", numberOfValues: 15 },
      }),
      abilityFacet: buildFacet(e, {
        // Many distinct abilities across the dex; start at 50 and tune after re-index.
        options: {
          facetId: "pokemonability",
          field: "pokemonability",
          numberOfValues: 50,
          // Large dex: ensure facet scan depth is not the bottleneck (default 1000).
          injectionDepth: 5000,
        },
      }),
    };
  }
  return controllers;
}

export function coveoConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_COVEO_ORG_ID &&
      process.env.NEXT_PUBLIC_COVEO_API_KEY,
  );
}
