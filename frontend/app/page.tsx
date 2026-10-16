import fs from "node:fs";
import path from "node:path";
import NdaCreator from "@/components/NdaCreator";

export default function Home() {
  const dir = path.join(process.cwd(), "..", "templates");
  const standardTerms = fs.readFileSync(path.join(dir, "Mutual-NDA.md"), "utf8");
  return <NdaCreator standardTerms={standardTerms} />;
}
