import VKApi from "../api";
import { User } from "../../../model/conversation";

export default abstract class VKUser extends User<VKApi>{ }
