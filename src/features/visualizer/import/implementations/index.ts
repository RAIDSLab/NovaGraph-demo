import * as ImportAuto from "./auto";
import * as ImportCSV from "./csv";
import * as ImportGEXF from "./gexf";
import * as ImportGraphML from "./graphml";
import * as ImportJSON from "./json";
import * as ImportTXT from "./txt";
import type { ImportOption } from "./types";

// Export all import options
const ALL_IMPORTS: ImportOption[] = [
  ...Object.values(ImportCSV),
  ...Object.values(ImportJSON),
  ...Object.values(ImportTXT),
  ...Object.values(ImportGraphML),
  ...Object.values(ImportGEXF),
  ...Object.values(ImportAuto),
];
export default ALL_IMPORTS;

export { type ImportOption } from "./types";
