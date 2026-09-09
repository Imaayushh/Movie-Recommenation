/* Original C program this project was ported from. Kept verbatim for reference.
 *
 * Known inconsistencies that had to be resolved in the port (see README.md):
 *   1. ratings[10][5] is 10 users x 5 movies, but there are 5 users and 10 movies.
 *   2. matrix[3][20] caps the app at 20 reviews.
 *   3. Category id 7 was never assigned.
 *   4. `case 2: Give Your suggestions` was empty — that is now the genre engine.
 */
#include <stdio.h>
int k = 0;
int scify = 0;
int actionfilm = 1;
int thriller = 2;
int drama = 3;
int crime = 4;
int biography = 5;
int horror = 6;
int adventure = 8;
int superhero = 9;
int comedy = 10;
int matrix[3][20];
struct movie {
char moviename[30];
int category;
};
int main()
{
// 10 Users x 5 Movies
// 0 = Not Rated
// 1-5 = Rating
int ratings[10][5] = {
{5, 2, 4, 0, 3},
{2, 4, 5, 3, 0},
{1, 5, 4, 2, 3},
{4, 2, 3, 5, 1},
{0, 3, 1, 4, 5},
{5, 1, 4, 3, 2},
{3, 4, 2, 0, 5},
{1, 2, 5, 4, 3},
{4, 5, 3, 2, 1},
{5, 3, 4, 0, 5}
};
/*char *movies[10] = {
"Avengers",
"Inception",
"Oppenheimer",
"Interstellar",
"KGF",
"Batman",
"Avengers: Endgame",
"The dark knight",
"Shawshank Redemption",
"The Godfather"
};*/
struct movie movies[] = {
{"Avengers",9},
{"Inception",0},
{"Oppenheimer",5},
{"Interstellar",0},
{"KGF",1},
{"Batman",9},
{"Avengers: Endgame",9},
{"The dark knight",2},
{"Shawshank Redemption",3},
{"The Godfather",4},
};
char *users[5] = {
"Aayush",
"Aniket",
"Mayuresh",
"Prathamesh",
"Yuvraj"
};
char user[30];
int choice=0;
while(choice!=4){
printf("\n 1.Give your review");
printf("\n 2.Give Your suggestions");
printf("\n 3.Top Retings of movies");
printf("\n 4.Exit");
printf("\n\n Enter your choice - ");
scanf("%d",&choice);
int i;
int id;
int ratings;
int index;
int j;
switch(choice){
case 1 :
printf("Please give your review\n");
printf("Please provide your id - \n");
scanf("%d",&id);
for(i=0;i<10;i++){
printf("\n %d  %s",i,movies[i].moviename);
}
printf("For which movie you want to give review\n");
scanf("%d",&index);
printf("Give the Ratings between 1 to 5\n");
scanf("%d",&ratings);
matrix[0][k] = id;
matrix[1][k] = index;
matrix[2][k] = ratings;
k++;
break;
case 2 :
break;
case 3 : for(i=0;i<3;i++){
for(j=0;j<5;j++){
printf("%d  ",matrix[i][j]);
}
printf("\n");
}
break;
case 4 : printf("");
break;
default : printf("Invalid choice");
}
}
return 0;
}
