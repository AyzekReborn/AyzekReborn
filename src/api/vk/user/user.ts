import { User } from "../../../model/conversation";
import VKApi from "../api";

export default abstract class VKUser extends User<VKApi>{ }
