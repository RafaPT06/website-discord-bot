const express=require('express');
const app=express();
app.use(express.static('public'));
app.get('/api/status',(req,res)=>res.json({status:'online'}));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Website running on ${PORT}`));
