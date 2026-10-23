// Initialise the single-node replica set required for multi-document transactions.
try {
  rs.status();
  print('Replica set rs0 already initialised.');
} catch {
  print('Initiating replica set rs0...');
  rs.initiate({
    _id: 'rs0',
    members: [{ _id: 0, host: 'mongo:27017' }],
  });
}

for (let attempt = 0; attempt < 30; attempt += 1) {
  if (db.hello().isWritablePrimary) {
    print('Replica set primary is ready.');
    break;
  }
  sleep(1000);
}
