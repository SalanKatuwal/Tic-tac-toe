let boxes=document.querySelectorAll(".box");
let reset=document.querySelector("#reset");
let msgContainer=document.querySelector(".msg-container");
let newGame=document.querySelector("#newGame");
let msg=document.querySelector("#msg");


turn0=true;
let winPatterns=[
    [0,1,2],
    [3,4,5],
    [6,7,8],
    [0,3,6],
    [1,4,7],
    [2,5,8],
    [0,4,8],
    [2,4,6]
]
let count=0;
boxes.forEach((box)=>{
    box.addEventListener("click",()=>{
        if(turn0){
            box.style.color="green";
            box.innerText="X";
            turn0=false;
        }
        else{
            box.style.color="red";
            box.innerText="O";
            turn0=true;
        }
        box.disabled=true;
        checkWinner();
        count++;
        console.log(count)
        if(count==9){
            msg.innerText=("The game is a draw");
            msgContainer.classList.remove("hide");
        }
    })
});

const checkWinner=()=>{
    for(let pattern of winPatterns){
        let pos1=boxes[pattern[0]].innerText;
        let pos2=boxes[pattern[1]].innerText;
        let pos3=boxes[pattern[2]].innerText;
        
        if(pos1!="" && pos2!="" && pos3!=""){
            if(pos1==pos2 && pos2==pos3){
                disbleBox();
                showWinner(pos1);
            }
        }
    
    }
}
const showWinner=(winner)=>{
    msg.innerText=`Congratulations the winner is ${winner}`;
    msgContainer.classList.remove("hide");

};
const disbleBox=()=>{
    for(let box of boxes){
        box.disabled = true;
    }
};
const resetGame=()=>{
    count=0;
    turn0=true;
    enableBox();
    msgContainer.classList.add("hide");
}
const enableBox=()=>{
    for(let box of boxes){
        box.disabled=false;
        box.innerText="";
    }
}

newGame.addEventListener("click",resetGame);
reset.addEventListener("click",resetGame);