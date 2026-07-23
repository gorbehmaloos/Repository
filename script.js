const url =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vRULrojEZLgtKk-T0DkFu0fJlXZoWystL0wYlDEwv78YIN1Q-1HmEMQny8lSYBITNPMHp-3Ym638D_y/pub?output=csv";


let marketData = [];
let headers = [];

let sortColumn = -1;
let sortDirection = 1;




function persianToEnglish(str){

    if(!str) return "";

    return str
    .replace(/[۰-۹]/g,function(d){
        return "۰۱۲۳۴۵۶۷۸۹".indexOf(d);
    })
    .replace(/,/g,"")
    .trim();

}






function loadData(){


fetch(url)

.then(response=>response.text())

.then(csv=>{


let rows = csv.split("\n");



let headerIndex =
rows.findIndex(row=>row.includes("نماد"));



if(headerIndex===-1)
return;



rows = rows.slice(headerIndex);



headers =
rows[0]
.split(",")
.map(x=>x.replace(/"/g,"").trim());



marketData =
rows.slice(1)
.map(row=>
row.split(",")
.map(x=>x.replace(/"/g,"").trim())
);



updateMarketTable();

updateStats();



document.getElementById("lastUpdate").innerText =
new Date().toLocaleTimeString("fa-IR");



});

}




function formatNumber(value){


let num =
persianToEnglish(value);



if(num==="" || isNaN(num))
return value;



return Number(num).toLocaleString("en-US");


}







function createTable(data,id){


let table =
document.getElementById(id);



table.innerHTML="";




// Header

let tr =
document.createElement("tr");



headers.forEach((h,index)=>{


let th =
document.createElement("th");



th.innerText=h;



if(sortColumn===index){


let arrow =
document.createElement("span");

arrow.className="sort-arrow";


arrow.innerText =
sortDirection===1 ? " ▲" : " ▼";


th.appendChild(arrow);


}




th.onclick=function(){

sortTable(index);

};



tr.appendChild(th);



});



table.appendChild(tr);






// Rows


data.forEach(row=>{


let tr =
document.createElement("tr");



row.forEach((cell,index)=>{


let td =
document.createElement("td");



let value=cell;



if(headers[index].includes("درصد")){


let num =
Number(persianToEnglish(cell));



if(num>0)

td.classList.add("positive");



if(num<0)

td.classList.add("negative");



}



else{

value=formatNumber(cell);

}



td.innerText=value;



tr.appendChild(td);



});



table.appendChild(tr);



});



}







function updateMarketTable(){


createTable(
marketData,
"marketTable"
);


}








function updateStats(){


let positive=0;

let negative=0;



let index =
headers.findIndex(
x=>x.includes("آخرین معامله - درصد")
);



marketData.forEach(row=>{


let value =
Number(persianToEnglish(row[index]));



if(value>0)

positive++;


if(value<0)

negative++;



});



document.getElementById("totalCount").innerText =
marketData.length;


document.getElementById("positiveCount").innerText =
positive;


document.getElementById("negativeCount").innerText =
negative;



}







// جستجو


document
.getElementById("searchInput")
.addEventListener("input",function(){



let text=this.value.trim();



if(text===""){

document.getElementById("searchTable").innerHTML="";

return;

}



let result =
marketData.filter(row=>{


return row[0].includes(text)
||
row[1].includes(text);



});



createTable(result,"searchTable");



});









function sortTable(column){



if(sortColumn===column)

sortDirection *= -1;


else{

sortColumn=column;

sortDirection=1;

}




marketData.sort(function(a,b){



let x =
persianToEnglish(a[column]);


let y =
persianToEnglish(b[column]);




let nx = Number(x);

let ny = Number(y);




if(!isNaN(nx) && !isNaN(ny)){


return (nx-ny)*sortDirection;


}




return x.localeCompare(y)*sortDirection;



});



updateMarketTable();



}






loadData();



// هر 60 ثانیه

setInterval(
loadData,
60000
);
