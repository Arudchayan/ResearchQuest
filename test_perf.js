const tasks = [];
for (let i = 0; i < 50000; i++) {
  tasks.push({
    id: i,
    title: `Task ${i}`,
    due_date: new Date(Date.now() + Math.random() * 10000000000).toISOString(),
    created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString()
  });
}

console.time('parseDateInput');
tasks.sort((a, b) => {
  const aDue = new Date(a.due_date).getTime();
  const bDue = new Date(b.due_date).getTime();
  if (aDue !== bDue) return aDue - bDue;
  return a.created_at > b.created_at ? 1 : -1;
});
console.timeEnd('parseDateInput');

console.time('stringComparison');
tasks.sort((a, b) => {
  if (a.due_date !== b.due_date) return a.due_date > b.due_date ? 1 : -1;
  return a.created_at > b.created_at ? 1 : -1;
});
console.timeEnd('stringComparison');
