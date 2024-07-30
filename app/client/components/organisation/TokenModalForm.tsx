import React, { useEffect } from "react";
import { connect } from "react-redux";

import { InputNumber, Modal, Form, Input, Radio } from "antd";
import { CreateTokenAction } from "../../reducers/token/actions";
import { CreateToken } from "../../reducers/token/types";
import { ReduxState } from "../../reducers/rootReducer";

declare global {
  interface Window {
    CHAIN_NAMES: string;
  }
}

interface DispatchProps {
  createToken: (body: CreateToken) => CreateTokenAction;
}

interface StateProps {
  tokens: ReduxState["tokens"];
}

interface TokenModalFormProps {
  visible: boolean;
  onCancel: () => void;
}

type IProps = DispatchProps & StateProps & TokenModalFormProps;

const TokenModalForm: React.FC<IProps> = props => {
  const [form] = Form.useForm();
  const chains = window.CHAIN_NAMES && window.CHAIN_NAMES.split(",");

  useEffect(() => {
    if (
      !props.tokens.createStatus.isRequesting &&
      props.tokens.createStatus.success
    ) {
      props.onCancel();
    }
  });
  return (
    <Modal
      visible={props.visible}
      title="Create a new token"
      okText="Create"
      cancelText="Cancel"
      onCancel={props.onCancel}
      confirmLoading={props.tokens.createStatus.isRequesting}
      onOk={() => {
        form
          .validateFields()
          .then((values: any) => {
            form.resetFields();
            props.createToken(values);
          })
          .catch(info => {
            console.log("Validate Failed:", info);
          });
      }}
    >
      <Form
        form={form}
        layout="vertical"
        name="form_in_modal"
        initialValues={{ modifier: "public" }}
      >
        <Form.Item
          name="name"
          label="Token Name"
          rules={[
            { required: true, message: "Please input the name of token!" }
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="symbol"
          label="Token Symbol"
          rules={[
            { required: true, message: "Please input the name of token!" }
          ]}
        >
          <Input maxLength={4} />
        </Form.Item>