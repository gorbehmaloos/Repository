const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRULrojEZLgtKk-T0DkFu0fJlXZoWystL0wYlDEwv78YIN1Q-1HmEMQny8lSYBITNPMHp-3Ym638D_y/pub?output=csv";


let marketData = [];
let headers = [];



fetch(url)

.then(response => response.text())

.then(csv => {


    let rows = csv.split("\n");


    // پیدا کردن Header اصلی
    let headerIndex = rows.findIndex(row => row.includes("نماد"));


    if(headerIndex === -1){

        alert("Header پیدا نشد");
        return;

    }



    rows = rows.slice(headerIndex);



    headers = rows[0]
        .split(",")
        .map(x => x.replace(/"/g,"").trim());



    marketData = rows.slice(1)
        .map(row => row.split(",").map(x=>x.replace(/"/g,"").trim()));



    updateMarketTable();

    updateStats();



});





// جداکننده هزارگان

function formatNumber(value){


    if(value === "" || isNaN(value))
        return value;


    return Number(value).toLocaleString("en-US");


}






function createTable(data, tableId){


    let table = document.getElementById(tableId);


    table.innerHTML = "";



    // header

    let tr = document.createElement("tr");


    headers.forEach(h=>{

        let th=document.createElement("th");

        th.innerText=h;

        tr.appendChild(th);

    });


    table.appendChild(tr);




    // rows


    data.forEach(row=>{


        let tr=document.createElement("tr");



        row.forEach((cell,index)=>{


            let td=document.createElement("td");



            let text=cell;



            // درصدها
            if(
                headers[index].includes("درصد")
            ){

                let num=parseFloat(cell);


                if(num>0)
                    td.classList.add("positive");


                if(num<0)
                    td.classList.add("negative");


            }


            else {

                text=formatNumber(cell);

            }



            td.innerText=text;


            tr.appendChild(td);


        });



        table.appendChild(tr);



    });



}







function updateMarketTable(){

    createTable(marketData,"marketTable");

}






function updateStats(){


    let positive=0;
    let negative=0;



    marketData.forEach(row=>{


        let index=headers.findIndex(
            x=>x.includes("آخرین معامله - درصد")
        );


        let value=parseFloat(row[index]);



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



    let result = marketData.filter(row=>{


        return row[0].includes(text)
        ||
        row[1].includes(text);


    });



    createTable(result,"searchTable");



});
