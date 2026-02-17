import { WALIndex } from "./event-bus/wal-index";

const index = new WALIndex(".data/wal");
await index.scan();
console.log("Segments:", JSON.stringify(index.getAllSegments(), null, 2));
console.log("Max sequence:", index.getMaxSequence());
await index.save();
