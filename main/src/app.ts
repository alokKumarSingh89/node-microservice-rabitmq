import { Product } from './entity/product';
import * as express from "express";
import * as cors from "cors";
import * as amqp from "amqplib/callback_api";
const queue_config = {
    product_created: "PRODUCT_CREATED",
    product_updated: 'PRODUCT_UPDATED',
    product_deleted: 'PRODUCT_DELETED'
}

import { createConnection } from "typeorm";
/**
 * Create database documents
 */
createConnection().then(db => {
    /**
     * get mongoRepo
     */

    const prodRepo = db.getMongoRepository(Product);

    /***
     * create connection with rabitmq
     */
    amqp.connect("RABITMQURL", (connect_error, connection) => {
        if (connect_error) {
            throw connect_error;
        }
        /**
         * Create channel here
         */
        connection.createChannel((channel_error, channel) => {
            if (channel_error) {
                throw channel_error;
            }

            /**
             * Create queue if not exits
             */
            channel.assertQueue(queue_config.product_created, { durable: false });
            channel.assertQueue(queue_config.product_updated, { durable: false });
            channel.assertQueue(queue_config.product_deleted, { durable: false });

            const app = express();
            app.use(cors({
                origin: ["http://localhost:3000"]
            }))
            app.use(express.json());

            /**
             * Consume product create queue
             */
            channel.consume(queue_config.product_created, async (msg) => {
                const eventProduct: Product = JSON.parse(msg.content.toString());
                const product = new Product();
                product.admin_id = parseInt(eventProduct.id);
                product.title = eventProduct.title;
                product.images = eventProduct.images;
                product.linkes = eventProduct.linkes;
                await prodRepo.save(product);
                console.log("product created");
            }, { noAck: true });

            /**
             * Product updated
             */
            channel.consume(queue_config.product_updated, async (msg) => {
                const eventProduct: Product = JSON.parse(msg.content.toString());
                const proeduct = await prodRepo.findOne({ admin_id: parseInt(eventProduct.id) });
                prodRepo.merge(proeduct, {
                    title: eventProduct.title,
                    images: eventProduct.images,
                    linkes: eventProduct.linkes
                });
                console.log("prosuct update")
            }, { noAck: true });

            /**
             * Delete the product
             */

            channel.consume(queue_config.product_deleted, async (msg) => {
                await prodRepo.deleteOne({ admin_id: parseInt(msg.content.toString()) })
            });

            app.listen(9001, () => {
                console.log("Running on 9001");
                process.on("beforeExit", () => {
                    console.log('closing');
                    connection.close();
                });
            })
        });
    });

}).catch(error => {
    console.log(error);
})
