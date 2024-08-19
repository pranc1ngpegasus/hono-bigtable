import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { Bigtable } from '@google-cloud/bigtable';
import { v7 as uuidv7 } from 'uuid';

// Bigtable
const instanceId = 'hono-bigtable';
const tableId = 'hono';
const maxAgeRule = {
  rule: {
    age: {
      // Value must be atleast 1 millisecond
      seconds: 60 * 60 * 24 * 5,
      nanos: 0,
    },
  },
};

const bigtable = new Bigtable();
const instance = bigtable.instance(instanceId);
const table = instance.table(tableId);

// Hono
const app = new Hono();

app.get("/healthcheck", (c) => c.text("ok"))
app.post("/table/create", async (c) => {
  const [tableExists] = await table.exists();
  if (tableExists) {
    return c.text("table already exists");
  }

  await table.create();
  await table.createFamily('stats', maxAgeRule);

  return c.text("table created");
})

app.delete("/table/delete", async (c) => {
  const [tableExists] = await table.exists();
  if (!tableExists) {
    return c.text("table does not exist");
  }

  await table.delete();

  return c.text("table deleted");
})

app.get("/data/list", async (c) => {
  let [rows] = await table.getRows({
    prefix: 'data#'
  });

  let results: any[] = [];
  rows.forEach(row => {
    results.push({
      key: row.id,
      data: row.data,
    })
  });

  return c.json(results);
})

app.post("/data/insert", async (c) => {
  const timestamp = new Date();
  const uuid = uuidv7();
  const rowToInsert = {
    key: `data#${uuid}`,
    data: {
      stats: {
        value: uuid.toString(),
        timestamp: timestamp,
      }
    }
  };
  await table.insert(rowToInsert);

  return c.json(rowToInsert);
})

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`)
})
