/* Shared by the editor and the embedded HTML. Refresh the embed with node scripts/sync-routing.cjs. */
const flowRouting = (() => {
function routeSegments(points) {
 return points.slice(1).map((point,index)=>[points[index],point]).filter(([a,b])=>a[0]!==b[0]||a[1]!==b[1]);
}
function lineMeetsRect([a,b],rect) {
 return Math.max(a[0],b[0])>=rect.left && Math.min(a[0],b[0])<=rect.right &&
  Math.max(a[1],b[1])>=rect.top && Math.min(a[1],b[1])<=rect.bottom;
}
function simplifyRoute(points) {
 const result=[];
 for(const point of points) {
  const last=result.at(-1),before=result.at(-2);
  if(last && last[0]===point[0] && last[1]===point[1])continue;
  if(before && [0,1].some(axis=>before[axis]===last[axis] && last[axis]===point[axis]))result.pop();
  result.push(point);
 }
 return result;
}
function routingGrid(boxes,connections) {
 const padding=7;
 const axes=[['left','right'],['top','bottom']].map(([start,end],axis)=>{
  const values=boxes.flatMap(box=>[box[start]-padding,box[end]+padding]);
  for(const connection of connections)for(const point of connection.terminals)values.push(point[axis]);
  const sorted=[...new Set(values)].sort((a,b)=>a-b);
  const lanes=sorted.flatMap((value,index)=>{
   const next=sorted[index+1];
   return next-value>25?[value,Math.round((value+next)*5)/10]:[value];
  });
  return [sorted[0]-24,...lanes,sorted.at(-1)+24];
 });
 const [xs,ys]=axes, width=xs.length, size=width*ys.length;
 // Bound work for imported diagrams and for routing while the user drags a card.
 if(size*boxes.length>3_000_000 || size*connections.length>700_000)return null;
 const point=id=>[xs[id%width],ys[Math.floor(id/width)]];
 const id=([x,y])=>ys.indexOf(y)*width+xs.indexOf(x);
 const links=new Uint8Array(size), occupied=new Uint16Array(size);
 for(let row=0;row<ys.length;row++)for(let col=0;col<width;col++) {
  const vertex=row*width+col,here=point(vertex);
  if(col+1<width && !boxes.some(box=>lineMeetsRect([here,point(vertex+1)],box))) {
   links[vertex]|=1;links[vertex+1]|=2;
  }
  if(row+1<ys.length && !boxes.some(box=>lineMeetsRect([here,point(vertex+width)],box))) {
   links[vertex]|=4;links[vertex+width]|=8;
  }
 }
 // Reserve the short segments at all ports before finding the rest of each route.
 for(const {ports,terminals} of connections)for(const [index,terminal] of terminals.entries()) {
  const port=ports[index],fixedAxis=port[0]===terminal[0]?0:1,axis=1-fixedAxis;
  const coordinates=axes[axis],step=axis===0?1:width,vertex=id(terminal);
  const indexOnAxis=coordinates.indexOf(terminal[axis]);
  const direction=port[axis]>terminal[axis]?1:-1;
  for(let next=indexOnAxis+direction;next>=0&&next<coordinates.length;next+=direction) {
   if((coordinates[next]-port[axis])*direction>0)break;
   occupied[vertex+(next-indexOnAxis)*step]++;
  }
 }
 return {links,occupied,id,point,width,size};
}
function searchRoute(grid,start,end,lastAxis) {
 const {links,occupied,id,point,width,size}=grid;
 const startId=id(start),endId=id(end),initial=startId*2;
 const previous=new Int32Array(size*2).fill(-1),score=new Float64Array(size*2).fill(Infinity);
 const heap=[];
 function push(item) {
  let index=heap.length;
  heap.push(item);
  while(index>0) {
   const parent=(index-1)>>1;
   if(heap[parent].priority<=item.priority)break;
   heap[index]=heap[parent];index=parent;
  }
  heap[index]=item;
 }
 function pop() {
  const first=heap[0],last=heap.pop();
  if(!heap.length)return first;
  let index=0;
  while(index*2+1<heap.length) {
   let child=index*2+1;
   if(child+1<heap.length && heap[child+1].priority<heap[child].priority)child++;
   if(heap[child].priority>=last.priority)break;
   heap[index]=heap[child];index=child;
  }
  heap[index]=last;
  return first;
 }
 score[initial]=0;
 push({state:initial,cost:0,priority:0});
 const directions=[1,-1,width,-width];
 while(heap.length) {
  const {state,cost}=pop();
  if(cost!==score[state])continue;
  const vertex=state>>1;
  if(vertex===endId) {
   const vertices=[];
   for(let cursor=state;cursor!==-1;cursor=previous[cursor])vertices.push(cursor>>1);
   return vertices.reverse();
  }
  const here=point(vertex);
  for(const [direction,step] of directions.entries()) {
   if(!(links[vertex]&(1<<direction)))continue;
   const next=vertex+step,target=point(next),axis=direction>>1,nextState=next*2+axis;
   const bend=(state%2!==axis?18:0)+(next===endId&&axis!==lastAxis?18:0);
   const nextCost=cost+Math.abs(target[axis]-here[axis])+bend+(next!==endId?occupied[next]*8000:0);
   if(nextCost>=score[nextState])continue;
   score[nextState]=nextCost;previous[nextState]=state;
   push({state:nextState,cost:nextCost,priority:nextCost+Math.abs(target[0]-end[0])+Math.abs(target[1]-end[1])});
  }
 }
 return null;
}
function measureRoutes(routes,boxes) {
 let crossings=0,obstructed=0,length=0;
 const conflicts=new Set();
 const lines=routes.map(route=>routeSegments(route.points));
 for(const [index,segments] of lines.entries()) {
  const route=routes[index];
  for(const [a,b] of segments)length+=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
  if(segments.some((segment,i)=>boxes.some(box=>{
   if((i===0&&box.id===route.from)||(i===segments.length-1&&box.id===route.to))return false;
   return lineMeetsRect(segment,box);
  }))){obstructed++;conflicts.add(route.index);}
  for(const [otherIndex,other] of lines.slice(0,index).entries())if(segments.some(segment=>other.some(([a,b])=>
   lineMeetsRect(segment,{left:Math.min(a[0],b[0]),right:Math.max(a[0],b[0]),top:Math.min(a[1],b[1]),bottom:Math.max(a[1],b[1])})
  ))){crossings++;conflicts.add(route.index);conflicts.add(routes[otherIndex].index);}
 }
 return {crossings,obstructed,length,conflicts};
}
function routeConnections(boxes,connections) {
 if(!connections.length)return {routes:[],crossings:0,obstructed:0,conflicts:new Set()};
 const grid=routingGrid(boxes,connections);
 function fallback([start,end]) {
  const lane=(start[0]+end[0])/2;
  return [start,[lane,start[1]],[lane,end[1]],end];
 }
 function connect(connection,interior) {
  const [from,to]=connection.ports;
  return {...connection,points:simplifyRoute([from,...interior,to])};
 }
 if(!grid){
  const routes=connections.map(connection=>connect(connection,fallback(connection.terminals)));
  return {routes,...measureRoutes(routes,boxes)};
 }
 const reserved=grid.occupied.slice();
 const sorted=[...connections].sort((a,b)=>Number(a.returning)-Number(b.returning));
 function distance({terminals:[from,to]}) {
  return Math.abs(from[0]-to[0])+Math.abs(from[1]-to[1]);
 }
 const longestFirst=[...connections].sort((a,b)=>distance(b)-distance(a));
 let best;
 for(const order of [sorted,[...sorted].reverse(),longestFirst,[...longestFirst].reverse()]) {
  grid.occupied.set(reserved);
  const routes=order.map(connection=>{
   const [start,end]=connection.terminals;
   const vertices=searchRoute(grid,start,end,connection.returning?1:0);
   if(vertices)for(const vertex of vertices)grid.occupied[vertex]++;
   const interior=vertices?vertices.map(grid.point):fallback(connection.terminals);
   return connect(connection,interior);
  });
  const score=measureRoutes(routes,boxes);
  const cost=score.obstructed*1e9+score.crossings*1e6+score.length;
  if(!best||cost<best.cost)best={routes,...score,cost};
  if(!score.obstructed&&!score.crossings)break;
 }
 return best;
}
return {routeConnections};
})();
