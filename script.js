const url =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vRULrojEZLgtKk-T0DkFu0fJlXZoWystL0wYlDEwv78YIN1Q-1HmEMQny8lSYBITNPMHp-3Ym638D_y/pub?output=csv";


let marketData = [];
let filteredData = [];
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




function formatNumber(value){

    let num = persianToEnglish(value);


    if(num==="" || isNaN(num))
        return value;


    return Number(num).toLocaleString("en-US");

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



filteredData=[...marketData];



updateMarketTable();

updateStats();



document.getElementById("lastUpdate").innerText =
new Date().toLocaleTimeString("fa-IR");


});


}






function createTable(data,id){


let table =
document.getElementById(id);



table.innerHTML="";



let tr=document.createElement("tr");



headers.forEach((h,index)=>{


let th=document.createElement("th");


th.innerText=h;



if(sortColumn===index){


let span=document.createElement("span");

span.className="sort-arrow";


span.innerText =
sortDirection===1 ? " ▲" : " ▼";


th.appendChild(span);


}



th.onclick=function(){

sortTable(index);

};



tr.appendChild(th);



});



table.appendChild(tr);
    data.forEach(row=>{


let tr=document.createElement("tr");



row.forEach((cell,index)=>{


let td=document.createElement("td");


let value=cell;



if(headers[index].includes("درصد")){


let n =
Number(persianToEnglish(cell));



if(n>0)

td.classList.add("positive");



if(n<0)

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
filteredData,
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
Number(
persianToEnglish(row[index])
);



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








// فعال کردن فیلتر

function setActiveFilter(buttonId){


document
.querySelectorAll(".filters button")
.forEach(btn=>{

btn.classList.remove("active");

});



document
.getElementById(buttonId)
.classList.add("active");


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
filteredData.filter(row=>{


return row[0].includes(text)
||
row[1].includes(text);


});



createTable(
result,
"searchTable"
);



});








// مرتب سازی


function sortTable(column){



if(sortColumn===column)

sortDirection*=-1;



else{

sortColumn=column;

sortDirection=1;

}



filteredData.sort(function(a,b){



let x =
persianToEnglish(a[column]);



let y =
persianToEnglish(b[column]);



let nx=Number(x);

let ny=Number(y);



if(!isNaN(nx) && !isNaN(ny)){


return (nx-ny)*sortDirection;


}



return x.localeCompare(y)*sortDirection;



});



updateMarketTable();


}
// پیدا کردن شماره ستون

function getColumn(name){

    return headers.findIndex(
        x=>x.includes(name)
    );

}







// فقط مثبت‌ها

document
.getElementById("positiveFilter")
.onclick=function(){


setActiveFilter("positiveFilter");


let index =
getColumn("آخرین معامله - درصد");



filteredData =
marketData.filter(row=>{


return Number(
persianToEnglish(row[index])
)>0;


});



updateMarketTable();


};









// فقط منفی‌ها

document
.getElementById("negativeFilter")
.onclick=function(){


setActiveFilter("negativeFilter");


let index =
getColumn("آخرین معامله - درصد");



filteredData =
marketData.filter(row=>{


return Number(
persianToEnglish(row[index])
)<0;


});



updateMarketTable();


};









// صف خرید

document
.getElementById("buyQueueFilter")
.onclick=function(){


setActiveFilter("buyQueueFilter");



let buyVolume =
getColumn("خرید - حجم");


let buyPrice =
getColumn("خرید - قیمت");


let closePrice =
getColumn("قیمت پایانی - مقدار");




filteredData =
marketData.filter(row=>{


return (

Number(
persianToEnglish(row[buyVolume])
)>0

&&

persianToEnglish(row[buyPrice])
===

persianToEnglish(row[closePrice])

);


});



updateMarketTable();


};









// صف فروش

document
.getElementById("sellQueueFilter")
.onclick=function(){


setActiveFilter("sellQueueFilter");



let sellVolume =
getColumn("فروش - حجم");


let sellPrice =
getColumn("فروش - قیمت");


let closePrice =
getColumn("قیمت پایانی - مقدار");




filteredData =
marketData.filter(row=>{


return (

Number(
persianToEnglish(row[sellVolume])
)>0

&&

persianToEnglish(row[sellPrice])
===

persianToEnglish(row[closePrice])

);


});



updateMarketTable();


};









// حذف فیلتر

document
.getElementById("clearFilter")
.onclick=function(){



filteredData=[...marketData];



setActiveFilter("clearFilter");



updateMarketTable();



};









// اجرای اولیه

loadData();




// رفرش خودکار هر 60 ثانیه

setInterval(
loadData,
60000
);
