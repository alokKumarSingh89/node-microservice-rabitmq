import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Product {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column()
    images: string;

    @Column({ default: 0 })
    linkes: number;
}