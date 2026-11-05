// Nonadjacent triangle intersections, including coplanar interiors.
module.exports=function check(mesh){
 const sub=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],eps=1e-7;
 const tris=mesh.faces.map(f=>{const p=f.map(i=>mesh.vertices[i]);return {f,p,min:[0,1,2].map(i=>Math.min(...p.map(q=>q[i]))),max:[0,1,2].map(i=>Math.max(...p.map(q=>q[i])))};});
 function pierces(a,b,t){const [p,q,r]=t,e1=sub(q,p),e2=sub(r,p),d=sub(b,a),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<eps)return false;const s=sub(a,p),u=dot(s,h)/det,j=cross(s,e1),v=dot(d,j)/det,k=dot(e2,j)/det;return u>eps&&v>eps&&u+v<1-eps&&k>eps&&k<1-eps;}
 function overlapCoplanar(a,b){
  const n=cross(sub(a[1],a[0]),sub(a[2],a[0])),axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),project=p=>p.filter((_,i)=>i!==axis),A=a.map(project),B=b.map(project),orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const inside=(p,T)=>{const s=T.map((q,i)=>orient(q,T[(i+1)%3],p));return s.every(n=>n>eps)||s.every(n=>n< -eps);};
  if(A.some(p=>inside(p,B))||B.some(p=>inside(p,A)))return true;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(orient(A[i],A[(i+1)%3],B[j])*orient(A[i],A[(i+1)%3],B[(j+1)%3])< -eps&&orient(B[j],B[(j+1)%3],A[i])*orient(B[j],B[(j+1)%3],A[(i+1)%3])< -eps)return true;
  return false;
 }
 for(let i=0;i<tris.length;i++)for(let j=i+1;j<tris.length;j++){
  const a=tris[i],b=tris[j];if(a.f.some(id=>b.f.includes(id))||a.min.some((n,k)=>n>b.max[k]+eps||b.min[k]>a.max[k]+eps))continue;
  for(let k=0;k<3;k++)if(pierces(a.p[k],a.p[(k+1)%3],b.p)||pierces(b.p[k],b.p[(k+1)%3],a.p))throw new Error(`triangle intersection ${i}/${j}`);
  const n=cross(sub(a.p[1],a.p[0]),sub(a.p[2],a.p[0]));if(b.p.every(p=>Math.abs(dot(n,sub(p,a.p[0])))<eps)&&overlapCoplanar(a.p,b.p))throw new Error(`coplanar overlap ${i}/${j}`);
 }
};
