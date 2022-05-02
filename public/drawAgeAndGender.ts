export type WithAge<TSource> = TSource & {
    age: number
}
export type WithGender<TSource> = TSource & {
    gender: Gender
    genderProbability: number
}

export enum Gender {
    FEMALE = 'female',
    MALE = 'male'
}